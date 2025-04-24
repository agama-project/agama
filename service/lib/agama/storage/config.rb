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

        drives.find { |d| d.alias?(boot.device.device_alias) }
      end

      # Device config containing root.
      #
      # @return [Configs::Drive, Configs::VolumeGroup, nil]
      def root_device
        root_drive || root_volume_group
      end

      # Drive config containing root.
      #
      # @return [Configs::Drive, nil]
      def root_drive
        drives.find { |d| d.root? || d.partitions.any?(&:root?) }
      end

      # Volume group config containing a logical volume for root.
      #
      # @return [Configs::LogicalVolume, nil]
      def root_volume_group
        volume_groups.find { |v| v.logical_volumes.any?(&:root?) }
      end

      # Drive with the given alias.
      #
      # @return [Configs::Drive, nil]
      def drive(device_alias)
        drives.find { |d| d.alias?(device_alias) }
      end

      # @return [Array<Configs::Partition>]
      def partitions
        drives.flat_map(&:partitions)
      end

      # @return [Array<Configs::LogicalVolume>]
      def logical_volumes
        volume_groups.flat_map(&:logical_volumes)
      end

      # @return [Array<Configs::Filesystem>]
      def filesystems
        (
          drives.map(&:filesystem) +
          partitions.map(&:filesystem) +
          logical_volumes.map(&:filesystem)
        ).compact
      end
    end
  end
end
