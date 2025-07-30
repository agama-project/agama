# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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

require "agama/copyable"
require "agama/storage/configs/boot"

module Agama
  module Storage
    # Config used to calculate an storage proposal.
    #
    # See doc/storage_proposal_from_profile.md for a complete description of how the config is
    # generated from a profile.
    class Config
      include Copyable

      # Boot settings.
      #
      # @return [Configs::Boot]
      attr_accessor :boot

      # @return [Array<Configs::Drive>]
      attr_accessor :drives

      # @return [Array<Configs::VolumeGroup>]
      attr_accessor :volume_groups

      # @return [Array<Configs::MdRaid>]
      attr_accessor :md_raids

      # @return [Array]
      attr_accessor :btrfs_raids

      # @return [Array]
      attr_accessor :nfs_mounts

      def initialize
        @boot = Configs::Boot.new
        @drives = []
        @volume_groups = []
        @md_raids = []
        @btrfs_raids = []
        @nfs_mounts = []
      end

      # @return [Configs::Drive, nil]
      def boot_device
        return unless boot.configure? && boot.device.device_alias

        supporting_partitions.find { |d| d.alias?(boot.device.device_alias) }
      end

      # Drive config containing root.
      #
      # @return [Configs::Drive, nil]
      def root_drive
        drives.find { |d| root_device?(d) }
      end

      # MD RAID config containing root.
      #
      # @return [Configs::MdRaid, nil]
      def root_md_raid
        md_raids.find { |m| root_device?(m) }
      end

      # Volume group config containing a logical volume for root.
      #
      # @return [Configs::LogicalVolume, nil]
      def root_volume_group
        volume_groups.find { |v| root_device?(v) }
      end

      # Drive with the given alias.
      #
      # @param device_alias [String]
      # @return [Configs::Drive, nil]
      def drive(device_alias)
        drives.find { |d| d.alias?(device_alias) }
      end

      # MD RAID with the given alias.
      #
      # @param device_alias [String]
      # @return [Configs::MdRaid, nil]
      def md_raid(device_alias)
        md_raids.find { |d| d.alias?(device_alias) }
      end

      # Device supporting partitions and with the given alias
      #
      # @param device_alias [String]
      # @return [Configs::MdRaid, nil]
      def partitionable(device_alias)
        supporting_partitions.find { |d| d.alias?(device_alias) }
      end

      # @return [Array<Configs::Partition>]
      def partitions
        supporting_partitions.flat_map(&:partitions)
      end

      # @return [Array<Configs::LogicalVolume>]
      def logical_volumes
        volume_groups.flat_map(&:logical_volumes)
      end

      # @return [Array<Configs::Filesystem>]
      def filesystems
        supporting_filesystem.map(&:filesystem).compact
      end

      # Configs with configurable search.
      #
      # @return [Array<#search>]
      def supporting_search
        drives + md_raids + partitions
      end

      # Configs with configurable encryption.
      #
      # @return [Array<#encryption>]
      def supporting_encryption
        drives + md_raids + partitions + logical_volumes
      end

      # Configs with configurable filesystem.
      #
      # @return [Array<#filesystem>]
      def supporting_filesystem
        drives + md_raids + partitions + logical_volumes
      end

      # Configs with configurable size.
      #
      # @return [Array<#size>]
      def supporting_size
        partitions + logical_volumes
      end

      # Configs with configurable partitions.
      #
      # @return [#partitions]
      def supporting_partitions
        drives + md_raids
      end

      # Configs with configurable delete.
      #
      # @return [#delete?]
      def supporting_delete
        partitions
      end

      # Config objects that could act as physical volume
      #
      # @return [Array<Configs::Drive, Configs::Md, Configs::Partition>]
      def potential_for_pv
        drives + md_raids + partitions
      end

      # Config objects that could be used to create automatic physical volume
      #
      # @return [Array<Configs::Drive, Configs::Md>]
      def potential_for_pv_device
        drives + md_raids
      end

      # Config objects that could act as MD RAID member devices.
      #
      # @return [Array<Configs::Drive, Configs::Partition>]
      def potential_for_md_device
        drives + drives.flat_map(&:partitions)
      end

      # Encryption configs, excluding encryptions from skipped devices.
      #
      # @return [Array<Configs::Encryption>]
      def valid_encryptions
        valid_devices = supporting_encryption.reject { |c| skipped?(c) }

        [
          valid_devices.map(&:encryption),
          volume_groups.map(&:physical_volumes_encryption)
        ].flatten.compact
      end

      # Drive configs, excluding skipped ones.
      #
      # @return [Array<Configs::Drive>]
      def valid_drives
        drives.reject { |d| skipped?(d) }
      end

      # MD RAID configs, excluding skipped ones.
      #
      # @return [Array<Configs::MdRaid>]
      def valid_md_raids
        md_raids.reject { |r| skipped?(r) }
      end

      # Partitions configs, excluding skipped ones.
      #
      # @return [Array<Configs::Partition>]
      def valid_partitions
        partitions.reject { |p| skipped?(p) }
      end

      # Configs directly using a device with the given alias.
      #
      # @note Devices using the given alias as a target device (e.g., for creating physical volumes)
      #   are not considered as users because the device is not directly used.
      #
      # @param device_alias [String]
      # @return [Array<Configs::MdRaid, Configs::VolumeGroup>]
      def users(device_alias)
        md_users(device_alias) + vg_users(device_alias)
      end

      # Configs directly using the given alias as target device.
      #
      # @param device_alias [String]
      # @return [Array<Configs::Boot, Configs::VolumeGroup>]
      def target_users(device_alias)
        [boot_target_user(device_alias), vg_target_users(device_alias)].flatten.compact
      end

    private

      # MD RAIDs using the given alias as member device.
      #
      # @param device_alias [String]
      # @return [Array<Configs::MdRaid>]
      def md_users(device_alias)
        device = potential_for_md_device.find { |d| d.alias?(device_alias) }
        return [] unless device

        md_raids.select { |m| m.devices.include?(device_alias) }
      end

      # Volume groups using the given alias as physical volume.
      #
      # @param device_alias [String]
      # @return [Array<Configs::VolumeGroup>]
      def vg_users(device_alias)
        device = potential_for_pv.find { |d| d.alias?(device_alias) }
        return [] unless device

        volume_groups.select { |v| v.physical_volumes.include?(device_alias) }
      end

      # Boot config if it uses the given alias as target for creating the boot partition.
      #
      # @param device_alias [String]
      # @return [Configs::Boot, nil]
      def boot_target_user(device_alias)
        return unless boot_device&.alias?(device_alias)

        boot
      end

      # Volume groups using the given alias as target for physical volumes.
      #
      # @param device_alias [String]
      # @return [Array<Configs::VolumeGroup>]
      def vg_target_users(device_alias)
        device = potential_for_pv_device.find { |d| d.alias?(device_alias) }
        return [] unless device

        volume_groups.select { |v| v.physical_volumes_devices.include?(device_alias) }
      end

      # Whether the device config contains root.
      #
      # @param device [Configs::Drive, Configs::MdRaid, Configs::VolumeGroup]
      # @return [Boolean]
      def root_device?(device)
        case device
        when Configs::Drive, Configs::MdRaid
          device.root? || device.partitions.any?(&:root?)
        when Configs::VolumeGroup
          device.logical_volumes.any?(&:root?)
        else
          false
        end
      end

      # Whether the config is skipped.
      #
      # @param config
      # @return [Boolean]
      def skipped?(config)
        return false unless config.respond_to?(:skipped?)

        config.skipped?
      end
    end
  end
end
