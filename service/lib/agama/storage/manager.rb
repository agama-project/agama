# frozen_string_literal: true

# Copyright (c) [2022-2025] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require "agama/config"
require "agama/http/clients"
require "agama/issue"
require "agama/storage/actions_generator"
require "agama/storage/bootloader"
require "agama/storage/callbacks"
require "agama/storage/configurator"
require "agama/storage/finisher"
require "agama/storage/umounter"
require "agama/storage/iscsi/manager"
require "agama/storage/proposal"
require "agama/with_locale"
require "yast/i18n"
require "y2storage/clients/inst_prepdisk"
require "y2storage/luks"
require "y2storage/storage_manager"

module Agama
  module Storage
    # Manager to handle storage configuration
    class Manager
      include Yast::I18n
      include WithLocale

      # @return [Agama::Config]
      attr_reader :product_config

      # @return [Hash, nil]
      attr_reader :config_json

      # @return [Bootloader]
      attr_reader :bootloader

      # @return [Array<Issue>]
      attr_reader :issues

      # @param logger [Logger, nil]
      def initialize(logger: nil)
        @logger = logger || Logger.new($stdout)
        @bootloader = Bootloader.new(logger)
        @issues = []
        @yast_no_bls_boot = ENV["YAST_NO_BLS_BOOT"]
        update_product_config(Agama::Config.new)
      end

      # Assigns a new product config.
      #
      # @param product_config [Agama::Config]
      def update_product_config(product_config)
        @product_config = product_config
        proposal.product_config = product_config
        configure_no_bls_bootloader
      end

      def activated?
        !!@activated
      end

      # Resets any information regarding activation of devices that may be cached by Y2Storage.
      #
      # Note this does NOT deactivate any device. There is not way to revert a previous activation.
      def reset_activation
        Y2Storage::Luks.reset_activation_infos
      end

      # Activates the devices.
      def activate
        callbacks = Callbacks::Activate.new(questions_client, logger)
        Y2Storage::StorageManager.instance.activate(callbacks)
        @activated = true
      end

      def probed?
        Y2Storage::StorageManager.instance.probed?
      end

      # Whether the current proposal was already calculated for the given product and config.
      #
      # @param product_config_json [Hash]
      # @param config_json [Hash]
      #
      # @return [Boolean]
      def configured?(product_config_json, config_json)
        product_config.data == product_config_json && self.config_json == config_json
      end

      # Probes the devices.
      def probe
        callbacks = Y2Storage::Callbacks::UserProbe.new
        Y2Storage::StorageManager.instance.probe(callbacks)
      end

      # Configures storage.
      #
      # @param config_json [Hash, nil] Storage config according to the JSON schema. If nil, then
      #   the default config is applied.
      # @return [Boolean] Whether storage was successfully configured.
      def configure(config_json = nil)
        @config_json = config_json
        result = Configurator.new(proposal).configure(config_json)
        update_issues
        result
      end

      # Commits the storage changes.
      #
      # @return [Boolean] true if the all actions were successful.
      def install
        callbacks = Callbacks::Commit.new(questions_client, logger: logger)

        client = Y2Storage::Clients::InstPrepdisk.new(commit_callbacks: callbacks)
        client.run == :next
      end

      # Adds the required packages to the list of resolvables to install.
      def add_packages
        packages = devicegraph.used_features.pkg_list
        packages += ISCSI::Manager::PACKAGES if need_iscsi?
        return if packages.empty?

        logger.info "Selecting these packages for installation: #{packages}"
        http_client.set_resolvables(PROPOSAL_ID, :package, packages)
      end

      # Performs the final steps on the target file system(s).
      def finish
        Finisher.new(logger, product_config).run
      end

      # Performs the final umount of system before reboot.
      def umount
        Umounter.new(logger).run
      end

      # Storage proposal manager
      #
      # @return [Storage::Proposal]
      def proposal
        @proposal ||= Proposal.new(product_config, logger: logger)
      end

      # iSCSI manager
      #
      # @return [Storage::ISCSI::Manager]
      def iscsi
        @iscsi ||= ISCSI::Manager.new(logger: logger)
      end

      # Storage actions.
      #
      # @return [Array<Action>]
      def actions
        return [] unless Y2Storage::StorageManager.instance.probed?

        probed = Y2Storage::StorageManager.instance.probed
        staging = Y2Storage::StorageManager.instance.staging
        ActionsGenerator.new(probed, staging).generate
      end

      # Changes the service's locale
      #
      # @param locale [String] new locale
      def configure_locale(locale)
        change_process_locale(locale)
        update_issues
      end

      # Issues from the system
      #
      # @return [Array<Issue>]
      def system_issues
        probing_issues + [candidate_devices_issue].compact
      end

    private

      PROPOSAL_ID = "storage_proposal"
      private_constant :PROPOSAL_ID

      # @return [Logger]
      attr_reader :logger

      # Underlying yast-storage-ng has own mechanism for proposing boot strategies.
      # However, we don't always want to use BLS when it proposes so. Currently
      # we want to use BLS only for Tumbleweed / Slowroll
      def configure_no_bls_bootloader
        # Keep original value of the env variable or set it if needed.
        value = product_config.boot_strategy&.casecmp("BLS") ? @yast_no_bls_boot : "1"
        ENV["YAST_NO_BLS_BOOT"] = value
        # Avoiding problems with cached values
        Y2Storage::StorageEnv.instance.reset_cache
      end

      # Whether iSCSI is needed in the target system.
      #
      # @return [Boolean]
      def need_iscsi?
        devicegraph.used_features.any? { |f| f.id == :UF_ISCSI }
      end

      # Staging devicegraph
      #
      # @return [Y2Storage::Devicegraph]
      def devicegraph
        Y2Storage::StorageManager.instance.staging
      end

      # Recalculates the list of issues
      def update_issues
        @issues = proposal.issues
      end

      # Issues from the probing phase
      #
      # @return [Array<Issue>]
      def probing_issues
        y2storage_issues = Y2Storage::StorageManager.instance.raw_probed.probing_issues
        return [] if y2storage_issues.nil?

        y2storage_issues.map do |y2storage_issue|
          Issue.new(y2storage_issue.message, details: y2storage_issue.details)
        end
      end

      # Returns an issue if there is no candidate device for installation
      #
      # @return [Issue, nil]
      def candidate_devices_issue
        return if proposal.storage_system.candidate_devices.any?

        Issue.new(_("There is no suitable device for installation"))
      end

      # Returns the client to ask questions
      #
      # @return [Agama::HTTP::Clients::Questions]
      def questions_client
        @questions_client ||= Agama::HTTP::Clients::Questions.new(logger)
      end

      def http_client
        @http_client = Agama::HTTP::Clients::Main.new(::Logger.new($stdout))
      end
    end
  end
end
