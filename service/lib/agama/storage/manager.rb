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

require "yast"
require "bootloader/proposal_client"
require "y2storage/storage_manager"
require "y2storage/storage_env"
require "y2storage/clients/inst_prepdisk"
require "agama/storage/actions_generator"
require "agama/storage/bootloader"
require "agama/storage/proposal"
require "agama/storage/proposal_settings"
require "agama/storage/callbacks"
require "agama/storage/iscsi/manager"
require "agama/storage/finisher"
require "agama/storage/config_json_reader"
require "agama/issue"
require "agama/with_locale"
require "agama/with_issues"
require "agama/with_progress"
require "agama/security"
require "agama/dbus/clients/questions"
require "agama/dbus/clients/software"

Yast.import "PackagesProposal"

module Agama
  module Storage
    # Manager to handle storage configuration
    class Manager
      include WithLocale
      include WithIssues
      include WithProgress
      include Yast::I18n

      # @return [Agama::Config]
      attr_reader :product_config

      # @return [Bootloader]
      attr_reader :bootloader

      # Constructor
      #
      # @param product_config [Agama::Config]
      # @param logger [Logger]
      def initialize(product_config, logger)
        textdomain "agama"

        @product_config = product_config
        @logger = logger
        @bootloader = Bootloader.new(logger)
        register_proposal_callbacks
        on_progress_change { logger.info progress.to_s }
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

      # Probes storage devices and performs an initial proposal
      #
      # @param keep_config [Boolean] Whether to use the current storage config for calculating the
      #   proposal.
      def probe(keep_config: false)
        start_progress_with_size(4)
        product_config.pick_product(software.selected_product)

        # Underlying yast-storage-ng has own mechanism for proposing boot strategies.
        # However, we don't always want to use BLS when it proposes so. Currently
        # we want to use BLS only for Tumbleweed / Slowroll
        prohibit_bls_boot if !product_config.boot_strategy&.casecmp("BLS")

        check_multipath
        progress.step(_("Activating storage devices")) { activate_devices }
        progress.step(_("Probing storage devices")) { probe_devices }
        progress.step(_("Calculating the storage proposal")) do
          calculate_proposal(keep_config: keep_config)
        end
        progress.step(_("Selecting Linux Security Modules")) { security.probe }
        # The system is not deprecated anymore
        self.deprecated_system = false
        update_issues
        @on_probe_callbacks&.each(&:call)
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

      # Calculates the proposal.
      #
      # @param keep_config [Boolean] Whether to use the current storage config for calculating the
      #   proposal. If false, then the default config from the product is used.
      def calculate_proposal(keep_config: false)
        config_json = proposal.storage_json if keep_config
        config_json ||= ConfigJSONReader.new(product_config).read
        proposal.calculate_from_json(config_json)
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

      # Issues are updated when the proposal is calculated
      def register_proposal_callbacks
        proposal.on_calculate { update_issues }
      end

      # Activates the devices, calling activation callbacks if needed
      def activate_devices
        callbacks = Callbacks::Activate.new(questions_client, logger)

        iscsi.activate
        Y2Storage::StorageManager.instance.activate(callbacks)
      end

      # Probes the devices
      def probe_devices
        callbacks = Y2Storage::Callbacks::UserProbe.new

        iscsi.probe
        Y2Storage::StorageManager.instance.probe(callbacks)
      end

      # Adds the required packages to the list of resolvables to install
      def add_packages
        devicegraph = Y2Storage::StorageManager.instance.staging
        packages = devicegraph.used_features.pkg_list
        return if packages.empty?

        logger.info "Selecting these packages for installation: #{packages}"
        Yast::PackagesProposal.SetResolvables(PROPOSAL_ID, :package, packages)
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
          available_devices_issue
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

      # Returns an issue if there is no available device for installation
      #
      # @return [Issue, nil]
      def available_devices_issue
        return if proposal.available_devices.any?

        Issue.new("There is no suitable device for installation",
          source:   Issue::Source::SYSTEM,
          severity: Issue::Severity::ERROR)
      end

      # Security manager
      #
      # @return [Security]
      def security
        @security ||= Security.new(logger, product_config)
      end

      # Returns the client to ask questions
      #
      # @return [Agama::DBus::Clients::Questions]
      def questions_client
        @questions_client ||= Agama::DBus::Clients::Questions.new(logger: logger)
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
