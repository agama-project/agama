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

require "agama/http/clients"
require "agama/dbus/clients/software"
require "agama/issue"
require "agama/security"
require "agama/storage/actions_generator"
require "agama/storage/bootloader"
require "agama/storage/callbacks"
require "agama/storage/configurator"
require "agama/storage/finisher"
require "agama/storage/iscsi/manager"
require "agama/storage/proposal"
require "agama/storage/proposal_settings"
require "agama/with_issues"
require "agama/with_locale"
require "agama/with_progress"
require "yast"
require "bootloader/proposal_client"
require "y2storage/clients/inst_prepdisk"
require "y2storage/luks"
require "y2storage/storage_env"
require "y2storage/storage_manager"

Yast.import "PackagesProposal"

module Agama
  module Storage
    # Manager to handle storage configuration
    class Manager
      include WithLocale
      include WithIssues
      include WithProgressManager
      include Yast::I18n

      # @return [Agama::Config]
      attr_reader :product_config

      # @return [Bootloader]
      attr_reader :bootloader

      # Constructor
      #
      # @param product_config [Agama::Config]
      # @param logger [Logger, nil]
      def initialize(product_config, logger: nil)
        textdomain "agama"

        @product_config = product_config
        @logger = logger || Logger.new($stdout)
        @bootloader = Bootloader.new(logger)

        register_progress_callbacks
      end

      # Whether the system is in a deprecated status
      #
      # The system is usually set as deprecated as effect of managing some kind of devices, for
      # example, when iSCSI sessions are created.
      #
      # A deprecated system means that the probed system could not match with the current system.
      #
      # @return [Boolean]
      def deprecated_system?
        !!@deprecated_system
      end

      # Sets whether the system is deprecated
      #
      # If the deprecated status changes, then callbacks are executed and the issues are
      # recalculated, see {#on_deprecated_system_change}.
      #
      # @param value [Boolean]
      def deprecated_system=(value)
        return if deprecated_system? == value

        @deprecated_system = value
        @on_deprecated_system_change_callbacks&.each(&:call)
        update_issues
      end

      # Registers a callback to be called when the system is set as deprecated
      #
      # @param block [Proc]
      def on_deprecated_system_change(&block)
        @on_deprecated_system_change_callbacks ||= []
        @on_deprecated_system_change_callbacks << block
      end

      # Registers a callback to be called when the system is probed
      #
      # @param block [Proc]
      def on_probe(&block)
        @on_probe_callbacks ||= []
        @on_probe_callbacks << block
      end

      # Registers a callback to be called when storage is configured.
      #
      # @param block [Proc]
      def on_configure(&block)
        @on_configure_callbacks ||= []
        @on_configure_callbacks << block
      end

      # TODO: move to storage_service
      def setup
        # Underlying yast-storage-ng has own mechanism for proposing boot strategies.
        # However, we don't always want to use BLS when it proposes so. Currently
        # we want to use BLS only for Tumbleweed / Slowroll
        prohibit_bls_boot if !product_config.boot_strategy&.casecmp("BLS")
        check_multipath
      end

      def activated?
        !!@activated
      end

      def reset_activation
        Y2Storage::Luks.reset_activation_infos
        @activated = false
      end

      # Activates the devices.
      def activate
        iscsi.activate
        callbacks = Callbacks::Activate.new(questions_client, logger)
        Y2Storage::StorageManager.instance.activate(callbacks)
        @activated = true
      end

      def probed?
        Y2Storage::StorageManager.instance.probed?
      end

      # Probes the devices.
      def probe
        iscsi.probe
        callbacks = Y2Storage::Callbacks::UserProbe.new
        Y2Storage::StorageManager.instance.probe(callbacks)
      end

      # Prepares the partitioning to install the system
      def install
        start_progress_with_size(4)
        progress.step(_("Preparing bootloader proposal")) do
          # first make bootloader proposal to be sure that required packages are installed
          proposal = ::Bootloader::ProposalClient.new.make_proposal({})
          # then also apply changes to that proposal
          bootloader.write_config
          logger.debug "Bootloader proposal #{proposal.inspect}"
        end
        progress.step(_("Adding storage-related packages")) { add_packages }
        progress.step(_("Preparing the storage devices")) { perform_storage_actions }
        progress.step(_("Writing bootloader sysconfig")) do
          # call inst bootloader to get properly initialized bootloader
          # sysconfig before package installation
          Yast::WFM.CallFunction("inst_bootloader", [])
        end
      end

      # Performs the final steps on the target file system(s)
      def finish
        Finisher.new(logger, product_config, security).run
      end

      # Configures storage.
      #
      # @param config_json [Hash, nil] Storage config according to the JSON schema. If nil, then
      #   the default config is applied.
      # @return [Boolean] Whether storage was successfully configured.
      def configure(config_json = nil)
        result = Configurator.new(proposal).configure(config_json)
        update_issues
        @on_configure_callbacks&.each(&:call)
        result
      end

      # Configures storage using the current config.
      #
      # @note The proposal is not calculated if there is not a config yet.
      def configure_with_current
        config_json = proposal.storage_json
        configure(config_json) if config_json
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
        # Uses the same progress as manager. Note that the callbacks of the progess are configured
        # by the D-Bus object in order to properly update the Progress D-Bus interface.
        @iscsi ||= ISCSI::Manager.new(progress_manager: progress_manager, logger: logger)
      end

      # Returns the client to ask the software service
      #
      # @return [Agama::DBus::Clients::Software]
      def software
        @software ||= DBus::Clients::Software.instance
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
      def locale=(locale)
        change_process_locale(locale)
        update_issues
      end

      # Security manager
      #
      # @return [Security]
      def security
        @security ||= Security.new(logger, product_config)
      end

    private

      PROPOSAL_ID = "storage_proposal"
      private_constant :PROPOSAL_ID

      # @return [Logger]
      attr_reader :logger

      def prohibit_bls_boot
        ENV["YAST_NO_BLS_BOOT"] = "1"
        # avoiding problems with cached values
        Y2Storage::StorageEnv.instance.reset_cache
      end

      def register_progress_callbacks
        on_progress_change { logger.info(progress.to_s) }
      end

      # Adds the required packages to the list of resolvables to install
      def add_packages
        packages = devicegraph.used_features.pkg_list
        packages += ISCSI::Manager::PACKAGES if need_iscsi?
        return if packages.empty?

        logger.info "Selecting these packages for installation: #{packages}"
        Yast::PackagesProposal.SetResolvables(PROPOSAL_ID, :package, packages)
      end

      # Whether iSCSI is needed in the target system.
      #
      # @return [Boolean]
      def need_iscsi?
        iscsi.configured? || devicegraph.used_features.any? { |f| f.id == :UF_ISCSI }
      end

      # Staging devicegraph
      #
      # @return [Y2Storage::Devicegraph]
      def devicegraph
        Y2Storage::StorageManager.instance.staging
      end

      # Prepares the storage devices for installation
      #
      # @return [Boolean] true if the all actions were successful
      def perform_storage_actions
        callbacks = Callbacks::Commit.new(questions_client, logger: logger)

        client = Y2Storage::Clients::InstPrepdisk.new(commit_callbacks: callbacks)
        client.run == :next
      end

      # Recalculates the list of issues
      def update_issues
        self.issues = system_issues + proposal.issues
      end

      # Issues from the system
      #
      # @return [Array<Issue>]
      def system_issues
        issues = probing_issues + [
          deprecated_system_issue,
          candidate_devices_issue
        ]

        issues.compact
      end

      # Issues from the probing phase
      #
      # @return [Array<Issue>]
      def probing_issues
        y2storage_issues = Y2Storage::StorageManager.instance.raw_probed.probing_issues
        return [] if y2storage_issues.nil?

        y2storage_issues.map do |y2storage_issue|
          Issue.new(y2storage_issue.message,
            details:  y2storage_issue.details,
            source:   Issue::Source::SYSTEM,
            severity: Issue::Severity::WARN)
        end
      end

      # Returns an issue if the system is deprecated
      #
      # @return [Issue, nil]
      def deprecated_system_issue
        return unless deprecated_system?

        Issue.new("The system devices have changed",
          source:   Issue::Source::SYSTEM,
          severity: Issue::Severity::ERROR)
      end

      # Returns an issue if there is no candidate device for installation
      #
      # @return [Issue, nil]
      def candidate_devices_issue
        return if proposal.storage_system.candidate_devices.any?

        Issue.new("There is no suitable device for installation",
          source:   Issue::Source::SYSTEM,
          severity: Issue::Severity::ERROR)
      end

      # Returns the client to ask questions
      #
      # @return [Agama::HTTP::Clients::Questions]
      def questions_client
        @questions_client ||= Agama::HTTP::Clients::Questions.new(logger)
      end

      MULTIPATH_CONFIG = "/etc/multipath.conf"
      # Checks if all requirement for multipath probing is correct and if not
      # then log it
      def check_multipath
        # check if kernel module is loaded
        mods = `lsmod`.lines.grep(/dm_multipath/)
        logger.warn("dm_multipath modules is not loaded") if mods.empty?

        binary = system("which multipath")
        if binary
          conf = `multipath -t`.lines.grep(/find_multipaths "smart"/)
          logger.warn("multipath: find_multipaths is not set to 'smart'") if conf.empty?
        else
          logger.warn("multipath is not installed.")
        end
      end
    end
  end
end
