# Copyright (c) [2015] SUSE LLC
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
require "storage"
require "y2storage/disk_size"

module Y2Storage
  # Helper class to keep information about free disk space together.
  # That objects can represent an unpartitioned chunk (maybe within
  # and extended partition) or the space of a partition to be reused.
  class FreeDiskSpace
    # @!attribute disk
    #   @return [Partitionable]
    attr_reader :disk

    # there is Partition#disk vs. Partition#partitionable
    # mirror this here
    alias_method :partitionable, :disk

    # @!attribute region
    #   @return [Region]
    attr_reader :region

    # @overload growing=(value)
    #   Setter for {#growing?}
    #
    #   @param [Boolean] value
    attr_writer :growing

    # @overload exists=(value)
    #   Setter for {#exists?}
    #
    #   @param [Boolean] value
    attr_writer :exists

    # Constructor
    #
    # @param disk [Partitionable]
    # @param region [Region]
    def initialize(disk, region)
      @disk = disk
      # Store a duplicate of the original region, which could change or be
      # deleted (don't trust the garbage collector when SWIG is involved)
      region = Storage::Region.new(region.to_storage_value)
      @region = Y2Storage::Region.new(region)
      @growing = false
      @exists = true
    end

    # Whether this space is the one that will grow during the resize operation
    # that is being calculated.
    #
    # This is an auxiliary method to simplify resizing partitions during the
    # storage proposal.
    #
    # False by default, this is only set to true for one of the free spaces
    # while a candidate resize operation for a particular partition is being
    # checked.
    #
    # @return [Boolean]
    def growing?
      @growing
    end

    # Whether this space was already there before the resize operation
    # that is being calculated.
    #
    # This is an auxiliary method to simplify resizing partitions during the
    # storage proposal.
    #
    # True by default, false only for a new free space being added as result
    # of the resize operation that is currently being checked.
    #
    # @return [Boolean]
    def exists?
      @exists
    end

    # Whether the region belongs to a partition that is going to be reused
    #
    # This only makes sense in the case of DASD devices with an implicit partition table,
    # partitions are never deleted there, but 'reused' (nothing to do with the 'reuse' flag of
    # planned devices).
    #
    # @return [Boolean]
    def reused_partition?
      return false if growing?

      disk.partitions.map(&:region).include?(region)
    end

    # Return the name of the disk this slot is on.
    #
    # @return [String] disk_name
    def disk_name
      @disk.name
    end

    # Return the size of this slot.
    #
    # @return [DiskSize]
    def disk_size
      exists? ? region.size : DiskSize.zero
    end

    # Offset of the slot relative to the beginning of the disk
    #
    # @return [DiskSize]
    def start_offset
      region.block_size * region.start
    end

    # Grain for alignment
    #
    # The align grain is the size unit that must be used to specify beginning and
    # end of a partition in order to keep everything aligned.
    #
    # @return [DiskSize]
    def align_grain
      @align_grain ||= disk.as_not_empty { disk.partition_table.align_grain }
    end

    # Whether the partitions should be end-aligned.
    # @see Y2Storage::PartitionTables::Base#require_end_alignment?
    #
    # @return [Boolean]
    def require_end_alignment?
      @require_end_alignment ||= disk.as_not_empty { disk.partition_table.require_end_alignment? }
    end

    # Finds the remaining free space within the scope of the disk chunk defined by
    # this (possibly outdated) FreeDiskSpace object
    #
    # @raise [NoDiskSpaceError] if there is no free space in the devicegraph at the region
    #   defined by the current FreeDiskSpace object
    #
    # @param devicegraph [Devicegraph]
    # @return [FreeDiskSpace] free space within the area of the original FreeDiskSpace object
    def updated_free_space(devicegraph)
      disk = devicegraph.blk_devices.detect { |d| d.name == disk_name }
      spaces = disk.as_not_empty { disk.free_spaces }.select do |space|
        space.region.start >= region.start &&
          space.region.start < region.end
      end
      raise NoDiskSpaceError, "Exhausted free space" if spaces.empty?

      spaces.first
    end

    # @return [String]
    def to_s
      "#<FreeDiskSpace disk_name=#{disk_name}, size=#{disk_size}, start_offset=#{start_offset}>"
    end
  end
end
