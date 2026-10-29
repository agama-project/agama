# Copyright (c) [2019] SUSE LLC
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

require "y2storage/planned"
require "y2storage/proposal/creator_result"

module Y2Storage
  module Proposal
    # Class to create a multi-device Btrfs according to a Planned::Btrfs object
    class BtrfsCreator
      # @return [Devicegraph] initial devicegraph
      attr_reader :original_devicegraph

      # Constructor
      #
      # @param original_devicegraph [Devicegraph] initial devicegraph
      def initialize(original_devicegraph)
        @original_devicegraph = original_devicegraph
      end

      # Creates the Btrfs filesystem
      #
      # @param planned_filesystem [Planned::Btrfs]
      # @param device_names [Array<String>] names of block devices that should be part of the Btrfs
      #
      # @return [CreatorResult] result containing the new Btrfs
      def create_filesystem(planned_filesystem, device_names)
        devicegraph = original_devicegraph.duplicate

        devices = btrfs_devices(devicegraph, device_names)

        filesystem = planned_filesystem.format!(devices.first)

        devices.shift

        add_btrfs_devices(filesystem, devices)

        filesystem.data_raid_level = planned_filesystem.data_raid_level
        filesystem.metadata_raid_level = planned_filesystem.metadata_raid_level

        CreatorResult.new(devicegraph, filesystem.sid => planned_filesystem)
      end

      # Reuses the filesystem (does not create a new one)
      #
      # @param planned_filesystem [Planned::Btrfs]
      # @return [CreatorResult] result containing the reused Btrfs
      def reuse_filesystem(planned_filesystem)
        devicegraph = original_devicegraph.duplicate
        planned_filesystem.reuse!(devicegraph)

        CreatorResult.new(devicegraph, {})
      end

      private

      # Devices to add to the multi-device Btrfs
      #
      # @param devicegraph [Devicegraph]
      # @param device_names [Array<String>]
      #
      # @return [Array<BlkDevice>]
      def btrfs_devices(devicegraph, device_names)
        devices = device_names.map { |n| devicegraph.find_by_name(n) }

        devices.map { |d| d.encryption || d }
      end

      # Adds devices to a Btrfs filesystem
      #
      # @param filesystem [Y2Storage::Filesystems::Btrfs]
      # @param devices [Array<BlkDevice>]
      def add_btrfs_devices(filesystem, devices)
        devices.each { |d| add_btrfs_device(filesystem, d) }
      end

      # Adds a device to a Btrfs filesystem
      #
      # @param filesystem [Y2Storage::Filesystems::Btrfs]
      # @param device [BlkDevice]
      def add_btrfs_device(filesystem, device)
        wipe_device(device)
        filesystem.add_device(device)
      end

      # Wipes a device
      #
      # @param device [BlkDevice]
      def wipe_device(device)
        device.remove_descendants
      end
    end
  end
end
