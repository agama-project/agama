# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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
require "dinstaller/storage/proposal"
require "dinstaller/storage/proposal_settings"
require "dinstaller/storage/callbacks"
require "dinstaller/storage/iscsi/manager"
require "dinstaller/storage/finisher"
require "dinstaller/with_progress"
require "dinstaller/security"
require "dinstaller/validation_error"
require "dinstaller/dbus/clients/questions"
require "dinstaller/dbus/clients/software"

Yast.import "PackagesProposal"

module DInstaller
  module Storage
    # Manager to handle storage configuration
    class Manager
      include WithProgress

      # Whether the system is in a deprecated status
      #
      # The system is usually set as deprecated as effect of managing some kind of devices, for
      # example, when iSCSI sessions are created.
      #
      # A deprecated system means that the probed system could not match with the current system.
      attr_accessor :deprecated_system

      def initialize(config, logger)
        @config = config
        @logger = logger
        @deprecated_system = false
      end

      # Probes storage devices and performs an initial proposal
      def probe
        @deprecated_system = false
        start_progress(4)
        config.pick_product(software.selected_product)
        progress.step("Activating storage devices") { activate_devices }
        progress.step("Probing storage devices") { probe_devices }
        progress.step("Calculating the storage proposal") { calculate_proposal }
        progress.step("Selecting Linux Security Modules") { security.probe }
      end

      # Prepares the partitioning to install the system
      def install
        start_progress(4)
        progress.step("Preparing bootloader proposal") do
          # first make bootloader proposal to be sure that required packages are installed
          proposal = ::Bootloader::ProposalClient.new.make_proposal({})
          logger.debug "Bootloader proposal #{proposal.inspect}"
        end
        progress.step("Adding storage-related packages") { add_packages }
        progress.step("Preparing the storage devices") do
          Yast::WFM.CallFunction("inst_prepdisk", [])
        end
        progress.step("Writing bootloader sysconfig") do
          # call inst bootloader to get properly initialized bootloader
          # sysconfig before package installation
          Yast::WFM.CallFunction("inst_bootloader", [])
        end
      end

      # Performs the final steps on the target file system(s)
      def finish
        Finisher.new(logger, config, security).run
      end

      # Storage proposal manager
      #
      # @return [Storage::Proposal]
      def proposal
        @proposal ||= Proposal.new(logger, config)
      end

      # iSCSI manager
      #
      # @return [Storage::ISCSI::Manager]
      def iscsi
        @iscsi ||= ISCSI::Manager.new(logger: logger)
      end

      # Validates the storage configuration
      #
      # @return [Array<ValidationError>] List of validation errors
      def validate
        errors = [deprecated_system_error] + proposal.validate
        errors.compact
      end

      # Returns the client to ask the software service
      #
      # @return [DInstaller::DBus::Clients::Software]
      def software
        @software ||= DBus::Clients::Software.new
      end

    private

      PROPOSAL_ID = "storage_proposal"
      private_constant :PROPOSAL_ID

      # @return [Logger]
      attr_reader :logger

      # @return [Config]
      attr_reader :config

      # Activates the devices, calling activation callbacks if needed
      def activate_devices
        callbacks = Callbacks::Activate.new(questions_client, logger)

        iscsi.activate
        Y2Storage::StorageManager.instance.activate(callbacks)
      end

      # Probes the devices
      def probe_devices
        iscsi.probe
        # TODO: better probe callbacks that can report issue to user
        Y2Storage::StorageManager.instance.probe(Y2Storage::Callbacks::UserProbe.new)
      end

      # Calculates the proposal
      #
      # It reuses the settings from the previous proposal, if any.
      def calculate_proposal
        settings = proposal.settings

        if !settings
          settings = ProposalSettings.new
          # FIXME: by now, the UI only allows to select one disk
          device = proposal.available_devices.first&.name
          settings.candidate_devices << device if device
        end

        proposal.calculate(settings)
      end

      # Adds the required packages to the list of resolvables to install
      def add_packages
        devicegraph = Y2Storage::StorageManager.instance.staging
        packages = devicegraph.used_features.pkg_list
        return if packages.empty?

        logger.info "Selecting these packages for installation: #{packages}"
        Yast::PackagesProposal.SetResolvables(PROPOSAL_ID, :package, packages)
      end

      # Returns an error if the system is deprecated
      #
      # @return [ValidationError, nil]
      def deprecated_system_error
        return unless deprecated_system

        ValidationError.new("The system devices have changed")
      end

      # Security manager
      #
      # @return [Security]
      def security
        @security ||= Security.new(logger, config)
      end

      # Returns the client to ask questions
      #
      # @return [DInstaller::DBus::Clients::Questions]
      def questions_client
        @questions_client ||= DInstaller::DBus::Clients::Questions.new(logger: logger)
      end
    end
  end
end
