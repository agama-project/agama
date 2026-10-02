# Copyright (c) [2017-2019] SUSE LLC
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
require "y2storage/planned/device"
require "y2storage/planned/mixins"
require "y2storage/match_volume_spec"

module Y2Storage
  module Planned
    # Specification for a Y2Storage::Md object to be created during the
    # AutoYaST proposal
    #
    # @see Device
    class Md < Device
      include Planned::CanBeFormatted
      include Planned::CanBeMounted
      include Planned::CanBeEncrypted
      include Planned::CanBePv
      include Planned::CanBeBtrfsMember
      include MatchVolumeSpec

      # @return [String] tentative device name of the MD RAID
      attr_accessor :name

      # @return [DiskSize] see {Y2Storage::Md#chunk_size}
      attr_accessor :chunk_size

      # @return [MdParity] see {Y2Storage::Md#md_parity}
      attr_accessor :md_parity

      # @return [MdLevel] see {Y2Storage::Md#md_level}
      attr_accessor :md_level

      # Forced order in which the devices should be added to the final MD RAID.
      #   @see #add_devices
      #   @return [Array<String>] sorted list of device names
      attr_accessor :devices_order

      # @return [Y2Storage::PartitionTables::Type] Partition table type
      attr_accessor :ptable_type

      # @return [Array<Planned::Partition>] List of planned partitions
      attr_accessor :partitions

      # Constructor.
      #
      def initialize(name: nil)
        super()
        initialize_can_be_formatted
        initialize_can_be_mounted
        initialize_can_be_encrypted
        initialize_can_be_pv
        initialize_can_be_btrfs_member
        @name = name
        @partitions = []
      end

      # Adds the provided block devices to the existing MD array
      #
      # @see Y2Storage::Md#devices
      #
      # The block devices will be added to the array in the order specified by
      # {#devices_order}. If #{devices_order} is nil or empty, the devices will
      # be added in alphabetical order (AutoYaST documented behavior).
      #
      # @param md_device [Y2Storage::Md] MD device created to represent this
      #   planned device. It will be modified.
      # @param devices [Array<Y2Storage::BlkDevice>] block devices to add
      def add_devices(md_device, devices)
        sorted =
          if devices_order.nil? || devices_order.empty?
            devices.sort_by(&:name)
          else
            included, missing = devices.partition { |d| devices_order.include?(d.name) }
            included.sort_by! { |d| devices_order.index(d.name) }
            missing.sort_by!(&:name)
            included + missing
          end

        md_device.sorted_devices = sorted
      end

      # Whether the given name matches the name of the planned MD
      #
      # Apart from directly comparing the strings, this method is also
      # able to compare a string with a format like "/dev/md0" (by default,
      # the planned MD uses the libstorage-ng format for MD names, which looks
      # like "/dev/md/0").
      #
      # @param value [String] name been searched for
      # @return [Boolean] true if the names match
      def name?(value)
        return true if name == value

        basename = name.split("/").last
        return false unless basename =~ /^\d+$/

        value == "/dev/md#{basename}"
      end

      def self.to_string_attrs
        [:mount_point, :reuse_name, :name, :lvm_volume_group_name, :subvolumes]
      end

      protected

      # Values for volume specification matching
      #
      # @see MatchVolumeSpec
      def volume_match_values
        {
          mount_point:  mount_point,
          size:         nil,
          fs_type:      filesystem_type,
          partition_id: nil
        }
      end
    end
  end
end
