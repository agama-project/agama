# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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
require "agama/storage/config_conversions/from_json"

module Agama
  module Storage
    # Settings used to calculate an storage proposal.
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

      # @return [Array]
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

      # Name of the device that will presumably be used to boot the target system
      #
      # @return [String, nil] nil if there is no enough information to infer a possible boot disk
      def boot_device
        explicit_boot_device || implicit_boot_device
      end

      # return [Array<Configs::Partition>]
      def partitions
        drives.flat_map(&:partitions)
      end

      # return [Array<Configs::LogicalVolume>]
      def logical_volumes
        volume_groups.flat_map(&:logical_volumes)
      end

    private

      # Device used for booting the target system
      #
      # @return [String, nil] nil if no disk is explicitly chosen
      def explicit_boot_device
        return nil unless boot.configure?
        return nil unless boot.device

        boot_drive = drives.find { |d| d.alias == boot.device }
        boot_drive&.found_device&.name
      end

      # Device that seems to be expected to be used for booting, according to the drive definitions
      #
      # @return [String, nil] nil if the information cannot be inferred from the config
      def implicit_boot_device
        implicit_drive_boot_device || implicit_lvm_boot_device
      end

      # @see #implicit_boot_device
      #
      # @return [String, nil] nil if the information cannot be inferred from the list of drives
      def implicit_drive_boot_device
        root_drive = drives.find do |drive|
          drive.partitions.any? { |p| p.filesystem&.root? }
        end

        root_drive&.found_device&.name
      end

      # @see #implicit_boot_device
      #
      # @return [String, nil] nil if the information cannot be inferred from the list of LVM VGs
      def implicit_lvm_boot_device
        root_vg = root_volume_group
        return nil unless root_vg

        root_drives = drives.select { |d| drive_for_vg?(d, root_vg) }
        names = root_drives.map { |d| d.found_device&.name }.compact
        # Return the first name in alphabetical order
        names.min
      end

      # @see #implicit_lvm_boot_device
      #
      # @return [Configs::VolumeGroup, nil]
      def root_volume_group
        volume_groups.find do |vg|
          vg.logical_volumes.any? { |lv| lv.filesystem&.root? }
        end
      end

      # @see #implicit_lvm_boot_device
      #
      # @return [Boolean]
      def drive_for_vg?(drive, volume_group)
        return true if volume_group.physical_volumes_devices.any? { |d| drive.alias?(d) }

        volume_group.physical_volumes.any? do |pv|
          drive.partitions.any? { |p| p.alias?(pv) }
        end
      end
    end
  end
end
