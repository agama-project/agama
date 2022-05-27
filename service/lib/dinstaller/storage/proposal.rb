# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

require "y2storage/storage_manager"
require "y2storage/guided_proposal"
require "y2storage/proposal_settings"
require "y2storage/dialogs/guided_setup/helpers/disk"

module DInstaller
  module Storage
    # Backend class to calculate a storage proposal
    class Proposal
      class NoProposalError < StandardError; end

      # Constructor
      #
      # @param logger [Logger]
      def initialize(logger)
        @logger = logger
      end

      # Available devices for installation
      #
      # @return [Array<Y2Storage::Device>]
      def available_devices
        disk_analyzer.candidate_disks
      end

      # Label that should be used to represent the given disk in the UI
      #
      # NOTE: this is likely a temporary solution. The label should not be calculated in the backend
      # in the future. See the note about available_devices at {DBus::Storage::Proposal}.
      #
      # The label has the form: "NAME, SIZE, [USB], INSTALLED_SYSTEMS".
      #
      # Examples:
      #
      #   "/dev/sda, 250.00 GiB, Windows, OpenSUSE"
      #   "/dev/sdb, 8.00 GiB, USB"
      #
      # @param device [Y2Storage::Device]
      # @return [String]
      def device_label(device)
        disk_helper.label(device)
      end

      # Name of devices where to perform the installation
      #
      # @raise [NoProposalError] if no proposal yet
      #
      # @return [Array<String>]
      def candidate_devices
        raise NoProposalError unless proposal

        proposal.settings.candidate_devices
      end

      # Whether the proposal should create LVM devices
      #
      # @raise [NoProposalError] if no proposal yet
      #
      # @return [Boolean]
      def lvm?
        raise NoProposalError unless proposal

        proposal.settings.use_lvm
      end

      # Calculates a new proposal
      #
      # @param settings [Hash] settings to calculate the proposal
      #   (e.g., { "use_lvm" => true, "candidate_devices" => ["/dev/sda"]}). Note that keys should
      #   match with a public setter.
      #
      # @return [Boolean] whether the proposal was correctly calculated
      def calculate(settings = {})
        proposal_settings = generate_proposal_settings(settings)

        @proposal = Y2Storage::GuidedProposal.initial(
          settings:      proposal_settings,
          devicegraph:   probed_devicegraph,
          disk_analyzer: disk_analyzer
        )

        save

        !proposal.failed?
      end

    private

      # @return [Logger]
      attr_reader :logger

      # @return [Y2Storage::InitialGuidedProposal]
      attr_reader :proposal

      # Generates proposal settings from the given values
      #
      # @param settings [Hash]
      # @return [Y2Storage::ProposalSettings]
      def generate_proposal_settings(settings)
        proposal_settings = Y2Storage::ProposalSettings.new_for_current_product

        settings.each { |k, v| proposal_settings.public_send("#{k}=", v) }

        # XXX: microOS specific
        proposal_settings.force_enable_snapshots
        proposal_settings.windows_delete_mode = :all
        proposal_settings.linux_delete_mode = :all
        proposal_settings.other_delete_mode = :all
        proposal_settings.use_lvm = false
        proposal_settings.volumes = []
        root_volume = Y2Storage::VolumeSpecification.new(
          mount_point: "/",
          fs_type: "btrfs",
          desired_size: "20 GiB",
          min_size: "5 Gib",
          max_size: "20 GiB",
          weight: 20,
          snapshots: true,
          snapshots_configurable: false,
          btrfs_read_only: true,
          btrfs_default_subvolume: "@",
          subvolumes: [
            "root", "home", "opt", "srv", "boot/writable", "usr/local",
            # for arch specific use only x86_64 for now
            { "path" => "boot/grub2/i386-pc", "archs" => "x86_64" },
            { "path" => "boot/grub2/x86_64-efi", "archs" => "x86_64" }
          ]
        )
        var_volume = Y2Storage::VolumeSpecification.new(
          mount_point: "/var",
          fs_type: "btrfs",
          desired_size: "19 GiB",
          min_size: "5 Gib",
          max_size: "unlimited",
          weight: 40,
          snapshots: false,
          snapshots_configurable: false,
          btrfs_read_only: false,
          disable_order: 1
        )
        proposal_settings.volumes << root_volume << var_volume

        # XXX: end of microos
        proposal_settings
      end

      # Saves the proposal or restores initial devices if a proposal was not calculated
      def save
        if proposal.failed?
          storage_manager.staging = probed_devicegraph.dup
        else
          storage_manager.proposal = proposal
        end
      end

      # @return [Y2Storage::DiskAnalyzer]
      def disk_analyzer
        storage_manager.probed_disk_analyzer
      end

      # Helper to generate a disk label
      #
      # @return [Y2Storage::Dialogs::GuidedSetup::Helpers::Disk]
      def disk_helper
        @disk_helper ||= Y2Storage::Dialogs::GuidedSetup::Helpers::Disk.new(disk_analyzer)
      end

      # Devicegraph representing the system
      #
      # @return [Y2Storage::Devicegraph]
      def probed_devicegraph
        storage_manager.probed
      end

      def storage_manager
        Y2Storage::StorageManager.instance
      end
    end
  end
end
