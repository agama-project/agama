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

require "y2storage/storage_class_wrapper"
require "y2storage/blk_device"
require "y2storage/disk"
require "y2storage/align_policy"
require "y2storage/align_type"

module Y2Storage
  # A partition in a partitionable device (like a disk or RAID).
  #
  # This is a wrapper for Storage::Partition.
  class Partition < BlkDevice
    wrap_class Storage::Partition

    # @!method number
    #   Partition number extracted from its name (e.g. 2 for "/dev/sda2").
    #
    #   @raise [Storage::Exception] if name does not contain a number.
    #
    #   @return [Integer]
    storage_forward :number

    # @!method partition_table
    #   @return [PartitionTables::Base] the concrete subclass will depend
    #     on the type
    storage_forward :partition_table, as: "PartitionTables::Base"

    # @!method partitionable
    #   @return [Partitionable] device hosting the partition table.
    storage_forward :partitionable, as: "Partitionable"

    # @!attribute type
    #   {PartitionType Type} of the partition.
    #   @see PartitionType
    #
    #   @return [PartitionType]
    storage_forward :type, as: "PartitionType"
    storage_forward :type=

    # @!attribute id
    #   {PartitionId Id} of the partition.
    #   @see PartitionId
    #   @see #adapted_id= for a safer alternative to set this value
    #
    #   @return [PartitionId]
    storage_forward :id, as: "PartitionId"
    storage_forward :id=

    # @!method boot?
    #   Boot flag of the partition, only supported on Msdos.
    #
    #   @note
    #     1. To be
    #     [standard-conformant](https://en.wikipedia.org/wiki/Master_boot_record),
    #     setting the boot flag on a partition clears the boot flag on all
    #     other partitions of the partition table.
    #
    #     2. Partitions on GPT have no boot flag, "set <nr> boot on" with
    #     parted on GPT partitions only sets the partition type to EFI System
    #     Partition.
    #
    #   @return [Boolean]
    storage_forward :boot?

    # @!method boot=(flag)
    #   Set bot flag of the partition.
    #   @see boot?
    #
    #   @param flag [Boolean]
    storage_forward :boot=

    # @!method legacy_boot?
    #   Legacy boot flag of the partition, only supported on Gpt.
    #
    #   @return [Boolean]
    storage_forward :legacy_boot?

    # @!method legacy_boot=(flag)
    #   Set legacy boot flag of the partition.
    #
    #   @param flag [Boolean]
    storage_forward :legacy_boot=

    # @!method self.create(devicegraph, name, region, type)
    #   To get suitable values for this method, use
    #   {PartitionTables::Base#unused_partition_slots}
    #   @see Region
    #   @see #type
    #
    #   @param devicegraph [Devicegraph]
    #   @param name [String]
    #   @param region [Region]
    #   @param type [PartitionType]
    #   @return [Partition]
    storage_class_forward :create, as: "Partition"

    # @!method self.find_by_name(devicegraph, name)
    #   @param devicegraph [Devicegraph]
    #   @param name [String]
    #   @return [Partition] nil if there is no such partition.
    storage_class_forward :find_by_name, as: "Partition"

    # Disk the partition belongs to or nil if the partition is
    # not over a disk (e.g. a RAID).
    #
    # @return [Disk]
    def disk
      partitionable.is_a?(Disk) ? partitionable : nil
    end

    # Grain for alignment
    #
    # @see PartitionTables::Base#align_grain
    #
    # @param align_type [AlignType, nil]
    # @return [DiskSize]
    def align_grain(align_type = nil)
      partition_table.align_grain(align_type)
    end

    # Whether the first block of the partition is aligned according to
    # the partition table grain.
    #
    # @param align_type [AlignType, nil] see #align_grain
    # @return [Boolean]
    def start_aligned?(align_type = nil)
      region.start_aligned?(align_grain(align_type))
    end

    # Whether the final block of the partition is aligned according to
    # the partition table grain.
    #
    # @param align_type [AlignType, nil] see #align_grain
    # @return [Boolean]
    def end_aligned?(align_type = nil)
      region.end_aligned?(align_grain(align_type))
    end

    # Resizes the partition by moving its end, taking alignment and resizing
    # limits into account.
    #
    # This method never moves the partition start.
    #
    # It does nothing if resizing is not possible (see {ResizeInfo#resize_ok?}).
    #
    # If the requested size is greater or equal than the max provided by
    # {#resize_info}, the end will be adjusted to reach exactly that max size.
    # See {PartitionTables::Base#align_end} for the rationale.
    #
    # In any other case, the new end will always be within the min and max
    # provided by #{#resize_info} (even if the requested size is smaller than
    # that min). The end will be aligned according to align_type if possible.
    #
    # @param new_size [DiskSize] temptative new size of the partition, take into
    #   account that the result may differ a bit due to alignment or limits
    # @param align_type [AlignType, nil] type of alignment. Nil to avoid alignment.
    def resize(new_size, align_type: AlignType::OPTIMAL)
      log.info "Trying to resize #{name} (#{size}) to #{new_size} (align: #{align_type})"
      return unless can_resize?

      initial_region = region.dup
      max = resize_info.max_size
      min = align_type.nil? ? resize_info.min_size : aligned_min_size(align_type)
      min = [min, size].min

      self.size =
        if new_size > max
          max
        elsif new_size < min
          min
        else
          new_size
        end
      log.info "Partition #{name} size initially set to #{size}"

      return if align_type.nil?

      self.region = aligned_region(align_type, initial_region)
      log.info "Partition #{name} finally adjusted to #{size}"
    end

    # All partitions in the given devicegraph, in no particular order
    #
    # @param devicegraph [Devicegraph]
    # @return [Array<Partition>]
    def self.all(devicegraph)
      Partitionable.all(devicegraph).map(&:partitions).flatten
    end

    # @return [String]
    def inspect
      "<Partition #{name} #{size}, #{region.show_range}>"
    end

    # Sets the id, ensuring its value is compatible with the partition table.
    #
    # In general, use this method instead of #id= if unsure.
    #
    # @see PartitionTables::Base#partition_id_for
    # @see #id
    #
    # @param partition_id [PartitionId]
    def adapted_id=(partition_id)
      self.id = partition_table.partition_id_for(partition_id)
    rescue ::Storage::Exception
      # if we made some mistake, log an error but don't break completely
      fallback_id = PartitionId::LINUX
      log.error "Failed to set partition id #{partition_id}, falling back to #{fallback_id}"
      self.id = fallback_id
    end

    # Minimal size the partition could have while keeping its end aligned,
    # according to {#resize_info} and {#align_grain}
    #
    # @param align_type [AlignType, nil] see #align_grain
    def aligned_min_size(align_type = nil)
      min = resize_info.min_size

      length = min.to_i / region.block_size.to_i
      min_region = Region.create(region.start, length, region.block_size)
      grain = align_grain(align_type)
      overhead = min_region.end_overhead(grain)

      min += grain - overhead unless overhead.zero?
      min
    end

    # Distance between the end of the partition and the latest aligned block.
    # Zero if the end of the partition is aligned.
    #
    # @return [DiskSize]
    def end_overhead
      region.end_overhead(align_grain)
    end

    # Whether it is an implicit partition
    #
    # @see Y2Storage::PartitionTables::ImplicitPt
    #
    # @return [Boolean]
    def implicit?
      partition_table.type.is?(:implicit)
    end

    # Whether it is a swap partition
    #
    # @return [Boolean]
    def swap?
      id.is?(:swap) && formatted_as?(:swap)
    end

    # Whether it is a (valid) EFI System partition
    #
    # @return [Boolean]
    def efi_system?
      id.is?(:esp) && formatted_as?(:vfat)
    end

    # Whether the partition fulfills conditions to be used for a Windows system
    #
    # @return [Boolean]
    def windows_suitable?
      !disk.nil? && type.is?(:primary) && id.is?(:windows_system)
    end

    # Whether the given disk space is located right after this partition
    #
    # @param disk_space [FreeDiskSpace]
    # @return [Boolean]
    def subsequent_slot?(disk_space)
      return false if disk_space.disk != partition_table.partitionable
      return false unless disk_space.region.start > region.end

      # The simplest case can be easily evaluated
      return true if disk_space.region.start == (region.end + 1)

      # But if the end of the partition is not properly aligned, we may need to look closer
      # FIXME: this can likely be both simpler and more efficient. But since it's used
      # only for missaligned partitions is not a priority
      slots = partition_table.partitions + partition_table.unused_partition_slots
      break_points = slots.flat_map { |s| [s.region.start, s.region.end] }
      break_points.none? { |p| p > region.end && p < disk_space.region.start }
    end

    protected

    # Values for volume specification matching
    #
    # @see MatchVolumeSpec
    def volume_match_values
      super.merge(partition_id: id)
    end

    # @see Device#is?
    def types_for_is
      super << :partition
    end

    # Region resulting from aligning and applying limits to the current
    # partition region during the {#resize} operation.
    #
    # @param align_type [AlignType] type of alignment
    # @param fallback [Region] region to return if aligning is not possible
    # @return [Region]
    def aligned_region(align_type, fallback)
      max_length = resize_info.max_size.to_i / region.block_size.to_i
      max_end = region.start + max_length - 1
      new_region =
        begin
          partition_table.align_end(region, align_type, max_end: max_end)
        rescue Storage::AlignError
          nil
        end

      if new_region.nil? || new_region.size < resize_info.min_size
        fallback
      else
        new_region
      end
    end
  end
end
