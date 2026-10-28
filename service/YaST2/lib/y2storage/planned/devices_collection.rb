# Copyright (c) [2018-2020] SUSE LLC
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

require "forwardable"

module Y2Storage
  module Planned
    # This class holds a list of planned devices and offers an API to query the collection
    #
    # Instances of this classes are immutable, so methods like {#append} or {#prepend} will return
    # new instances.
    #
    # @example Create a collection
    #   disk = Disk.new
    #   vg = LvmVg.new
    #   collection = DevicesCollection.new([disk, vg])
    #
    # @example Filter by device type (e.g., disk devices)
    #   sda = Disk.new
    #   sdb = Disk.new
    #   vg = LvmVg.new
    #   collection = DevicesCollection.new([sda, sdb, vg])
    #   collection.disks #=> [sda, sdb]
    #
    # @example Combining collections
    #   disk = Disk.new
    #   vg = LvmVg.new
    #   collection0 = DevicesCollection.new([disk])
    #   collection1 = DevicesCollection.new([vg])
    #   combined = collection0.append(collection1)
    #   combined.devices #=> [disk, vg]
    class DevicesCollection
      extend Forwardable
      include Enumerable

      # @!attribute [r] devices
      #   @return [Array<Planned::Device>] List of planned devices
      attr_reader :devices

      def_delegators :all, :each

      def initialize(devices = [])
        @devices = devices
      end

      # Prepends the given devices to the collection
      #
      # @note This method returns a new instance.
      #
      # @param devices [Array<Y2Storage::Planned::Device>,Y2Storage::Planned::Device]
      #   Devices to add
      # @return [DevicesCollection]
      def prepend(devices)
        self.class.new(devices + @devices)
      end

      # Returns a new instance including the devices
      #
      # @param devices [Array<Y2Storage::Planned::Device>,Y2Storage::Planned::Device]
      #   Devices to add
      # @return [DevicesCollection]
      def append(devices)
        self.class.new(@devices + devices)
      end

      # Returns the list of planned partitions, including nested ones (within a disk)
      #
      # @return [Array<Planned::Partition>]
      def partitions
        @partitions ||= disk_partitions + md_partitions + bcache_partitions
      end

      # Returns the list of planned partitions for disks devices
      #
      # @return [Array<Planned::Partition>]
      def disk_partitions
        @disk_partitions ||= devices.select { |d| d.is_a?(Planned::Partition) } +
          disks.flat_map(&:partitions)
      end

      # Returns the list of planned partitions for software RAID devices
      #
      # @return [Array<Planned::Partition>]
      def md_partitions
        @md_partitions ||= mds.flat_map(&:partitions)
      end

      # Returns the list of planned partitions for bcache devices
      #
      # @return [Array<Planned::Partition>]
      def bcache_partitions
        @bcache_partitions ||= bcaches.flat_map(&:partitions)
      end

      # Returns the list of planned disks
      #
      # @return [Array<Planned::Disk>]
      def disks
        @disks ||= devices.select { |d| d.is_a?(Planned::Disk) }
      end

      # Returns the list of planned volume groups
      #
      # @return [Array<Planned::LvmVg>]
      def vgs
        @vgs ||= devices.select { |d| d.is_a?(Planned::LvmVg) }
      end

      # Returns the list of planned MD RAID devices
      #
      # @return [Array<Planned::Md>]
      def mds
        @mds ||= devices.select { |d| d.is_a?(Planned::Md) }
      end

      # Returns the list of planned bcache devices
      #
      # @return [Array<Planned::Bcache>]
      def bcaches
        @bcaches ||= devices.select { |d| d.is_a?(Planned::Bcache) }
      end

      # Returns the list of planned NFS filesystems
      #
      # @return [Array<Planned::Nfs>]
      def nfs_filesystems
        @nfs_filesystems ||= devices.select { |d| d.is_a?(Planned::Nfs) }
      end

      # Returns the list of planned LVM logical volumes
      #
      # @return [Array<Planned::LvmLv>]
      def lvs
        @lvs ||= vgs.flat_map(&:all_lvs)
      end

      # Returns the list of planned stray block devices.
      #
      # @return [Array<Planned::StrayBlkDevice>]
      def stray_blk_devices
        @stray_blk_devices ||= devices.select { |d| d.is_a?(Planned::StrayBlkDevice) }
      end

      # Returns the list of planned Btrfs filesystems
      #
      # @return [Array<Planned::Btrfs>]
      def btrfs_filesystems
        @btrfs_filesystems ||= devices.select { |d| d.is_a?(Planned::Btrfs) }
      end

      # Returns the list of planned Tmpfs filesystems
      #
      # @return [Array<Planned::Tmpfs>]
      def tmpfs_filesystems
        @tmpfs_filesystems ||= devices.select { |d| d.is_a?(Planned::Tmpfs) }
      end

      # Returns all devices, including nested ones
      #
      # @return [Array<Planned::Device>]
      def all
        @all ||= [].concat(partitions, disks, stray_blk_devices, vgs, lvs, mds, bcaches,
          btrfs_filesystems, nfs_filesystems)
      end

      # Returns the list of devices that can be mounted
      #
      # @return [Array<Planned::Device>]
      def mountable_devices
        @mountable_devices ||= all.select { |d| d.respond_to?(:mount_point) }
      end
    end
  end
end
