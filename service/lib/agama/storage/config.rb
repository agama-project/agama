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

      # Name of the device that will be used to boot the target system, if any.
      #
      # @note The config has to be solved.
      #
      # @return [String, nil]
      def boot_device
        return unless boot.configure? && boot.device.device_alias

        boot_drive = drives.find { |d| d.alias?(boot.device.device_alias) }
        boot_drive&.found_device&.name
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
