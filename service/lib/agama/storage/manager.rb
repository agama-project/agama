# frozen_string_literal: true

# Copyright (c) [2022-2026] SUSE LLC
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
require "agama/http/clients/questions"
require "agama/issue"
require "agama/storage/actions_generator"
require "agama/storage/bootloader_manager"
require "agama/storage/callbacks"
require "agama/storage/configurator"
require "agama/storage/finisher"
require "agama/storage/umounter"
require "agama/storage/iscsi/manager"
require "agama/storage/proposal"
require "agama/with_locale"
require "yast/i18n"
require "y2storage/clients/inst_prepdisk"
require "y2storage/feature"
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

      # @return [BootloaderManager]
      attr_reader :bootloader

      # @return [Array<Issue>]
      attr_reader :issues

      # @param logger [Logger, nil]
      def initialize(logger: nil)
        @logger = logger || Logger.new($stdout)
        @bootloader = BootloaderManager.new(logger)
        @issues = []
        update_product_config(Agama::Config.new)
      end

      # Assigns a new product config.
      #
      # @param product_config [Agama::Config]
      def update_product_config(product_config)
        @product_config = product_config
        proposal.product_config = product_config
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

      # Whether the current proposal was already calculated for the given product and config
      # (assuming the bootloader config has not changed).
      #
      # @param product_config_json [Hash]
      # @param config_json [Hash]
      #
      # @return [Boolean]
      def configured?(product_config_json, config_json)
        product_config.data == product_config_json && self.config_json == config_json
      end

      # Whether the current proposal was already calculated for the given bootloader config
      # (assuming the product and storage config have not changed).
      #
      # @param boot_config_json [Hash]
      # @return [Boolean]
      def configured_for_bootloader?(boot_config_json)
        # Check only the bootloader type since we know the rest of the bootloader configuration is
        # irrelevant (ie. does not influence the calculation of the storage setup).
        # Although formally it is a bit wrong since the manager should not know those details.
        bootloader_config.type == boot_config_json[:type]
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
        @proposal ||= Proposal.new(
          product_config, bootloader_config: bootloader_config, logger: logger
        )
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

      # Required packages for the used features.
      #
      # @return [Array<Y2Storage::Feature::Package>]
      def packages
        return [] unless proposal.success?

        packages = devicegraph.used_features.packages
        packages += iscsi_packages if need_iscsi?
        packages
      end

      # Changes the service's locale
      #
      # @param locale [String] new locale
      def configure_locale(locale)
        change_process_locale(locale)
      end

      # Issues from the system
      #
      # @return [Array<Issue>]
      def system_issues
        probing_issues + [candidate_devices_issue].compact
      end

      # Whether bootloader was probed.
      #
      # @return [Boolean]
      def bootloader_probed?
        bootloader.probed?
      end

      # Probes the available bootloaders.
      def probe_bootloader
        bootloader.probe
      end

      # Available bootloaders in the system.
      #
      # @ return [Array<Bootloader>]
      def available_bootloaders
        bootloader.available_bootloaders
      end

      # Current bootloader configuration
      #
      # @return [BootloaderConfig]
      def bootloader_config
        bootloader.config
      end

      # Updates the bootloader configuration
      #
      # @param config_json [Hash]
      def update_bootloader_config(config_json)
        bootloader_config.load_json(config_json)
      end

      # Configures the bootloader
      #
      # @see BootloaderManager#configure
      def configure_bootloader
        bootloader.configure(product_config)
      end

      # Installs the bootloader
      #
      # @see BootloaderManager#install
      def install_bootloader
        bootloader.install
      end

      # Required packages for bootloader.
      #
      # @return [Array<Y2Storage::Feature::Package>]
      def bootloader_packages
        bootloader.packages.map { |n| Y2Storage::Feature::Package.new(n) }
      end

    private

      PROPOSAL_ID = "storage_proposal"
      private_constant :PROPOSAL_ID

      # @return [Logger]
      attr_reader :logger

      # Packages required by iSCSI.
      #
      # @return [Array<<2Storage::Feature::Package>]
      def iscsi_packages
        ISCSI::Manager::PACKAGES.map { |n| Y2Storage::Feature::Package.new(n) }
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
    end
  end
end
