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
require "yast2/execute"
require "yast2/systemd/service"
require "bootloader/proposal_client"
require "bootloader/finish_client"
require "y2storage/storage_manager"
require "dinstaller/storage/proposal"
require "dinstaller/storage/proposal_settings"
require "dinstaller/storage/callbacks"
require "dinstaller/storage/iscsi/manager"
require "dinstaller/with_progress"
require "dinstaller/security"
require "dinstaller/dbus/clients/questions"
require "dinstaller/dbus/clients/software"
require "dinstaller/helpers"

Yast.import "PackagesProposal"

module DInstaller
  module Storage
    # Manager to handle storage configuration
    class Manager
      include WithProgress
      include Helpers

      def initialize(config, logger)
        @config = config
        @logger = logger
      end

      # Probes storage devices and performs an initial proposal
      def probe
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

      # Unmounts the target file system
      def finish
        steps = tpm_key? ? 6 : 5
        start_progress(steps)

        on_target do
          progress.step("Writing Linux Security Modules configuration") { security.write }
          progress.step("Installing bootloader") do
            ::Bootloader::FinishClient.new.write
          end
          if tpm_key?
            progress.step("Preparing the system to unlock the encryption using the TPM") do
              prepare_tpm_key
            end
          end
          progress.step("Configuring file systems snapshots") do
            Yast::WFM.CallFunction("snapshots_finish", ["Write"])
          end
          progress.step("Copying logs") do
            Yast::WFM.CallFunction("copy_logs_finish", ["Write"])
          end
          progress.step("Unmounting storage devices") do
            Yast::WFM.CallFunction("umount_finish", ["Write"])
          end
        end
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
        proposal.validate
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
        # TODO: probe callbacks
        iscsi.probe
        Y2Storage::StorageManager.instance.probe
      end

      # Calculates the default proposal
      def calculate_proposal
        settings = ProposalSettings.new
        # FIXME: by now, the UI only allows to select one disk
        device = proposal.available_devices.first&.name
        settings.candidate_devices << device if device

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

      # Returns the client to ask the software service
      #
      # @return [DInstaller::DBus::Clients::Software]
      def software
        @software ||= DBus::Clients::Software.new
      end

      def tpm_key?
        tpm_product? && tpm_proposal? && tpm_system?
      end

      def tpm_proposal?
        settings = proposal.calculated_settings
        settings.encrypt? && !settings.lvm
      end

      def tpm_system?
        Y2Storage::Arch.new.efiboot? && tpm_present?
      end

      def tpm_present?
        return @tpm_present unless @tpm_present.nil?

        @tpm_present =
          begin
            execute_fdectl("tpm-present")
            logger.info "FDE: TPMv2 detected"
            true
          rescue Cheetah::ExecutionFailed
            logger.info "FDE: TPMv2 not detected"
            false
          end
      end

      def tpm_product?
        config.data.fetch("security", {}).fetch("tpm_luks_open", false)
      end

      def prepare_tpm_key
        keyfile_path = File.join(Yast::Installation.destdir, "root", ".root.keyfile")
        execute_fdectl(
          "add-secondary-key", "--keyfile", keyfile_path,
          stdin:    "#{proposal.calculated_settings.encryption_password}\n",
          recorder: Yast::ReducedRecorder.new(skip: :stdin)
        )

        service = Yast2::Systemd::Service.find("fde-tpm-enroll.service")
        logger.info "FDE: TPM enroll service: #{service}"
        service&.enable
      rescue Cheetah::ExecutionFailed
        false
      end

      def execute_fdectl(*args)
        # Some subcommands like "tpm-present" should not require a --device argument, but they
        # currently do. Let's always us until the problem at fdectl is fully fixed.
        Yast::Execute.locally!("fdectl", "--device", fdectl_device, *args)
      end

      def fdectl_device
        Yast::Installation.destdir
      end
    end
  end
end
