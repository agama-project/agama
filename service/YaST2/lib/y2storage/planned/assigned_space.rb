# Copyright (c) [2015-2017] SUSE LLC
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
require "y2storage/disk_size"

module Y2Storage
  module Planned
    # Each one of the spaces contained in a PartitionsDistribution
    class AssignedSpace
      # @return [FreeDiskSpace]
      attr_reader :disk_space
      # @return [Array<Planned::Partition>]
      attr_reader :partitions
      # Number of logical partitions that must be created in the space
      attr_accessor :num_logical

      def initialize(disk_space, planned_partitions)
        @disk_space  = disk_space
        @partitions  = planned_partitions
        @num_logical = 0
        sort_partitions!
      end

      # Restriction imposed by the disk and the already existent partitions
      #
      # @return [Symbol, nil]
      #   Spaces with a value of :primary can only contain primary partitions.
      #   Spaces with :logical can only contain logical partitions.
      #   A value of nil means there are no restrictions imposed by the disk
      def partition_type
        @partition_type if @partition_type_calculated

        @partition_type_calculated = true
        disk.as_not_empty do
          table = disk.partition_table
          @partition_type = if table.extended_possible?
            if table.has_extended?
              inside_extended? ? :logical : :primary
            end
          else
            :primary
          end
        end
      end

      # Sum of the weights of all the planned partitions assigned to this space
      #
      # @return [Integer]
      def total_weight
        partitions.map { |p| p.weight || 0 }.reduce(:+)
      end

      # Checks if the volumes really fit into the assigned space
      #
      # TODO: We do not check for start_offset. Anyways,
      #  - max_start_offset is usually a soft requirements (it may still work)
      #  - the chances of having 2 volumes with max_start_offset in the same
      #    free space are very low
      def valid?
        return false if wrong_usage_of_reused_partition?
        return false unless primary_partitions_fit?
        return true if disk_space.growing?
        return true if usable_size >= DiskSize.sum(partitions.map(&:min), rounding: align_grain)

        # At first sight, there is no enough space, but maybe enforcing some
        # order...
        !enforced_last.nil?
      end

      # Space that will remain unused (wasted) after creating the partitions
      #
      # @return [DiskSize]
      def unused
        max = DiskSize.sum(partitions.map(&:max))
        (max >= usable_size) ? DiskSize.zero : usable_size - max
      end

      # Space available in addition to the target
      #
      # This method is slightly pessimistic. In a quite specific corner case, one
      # of the volumes could be adjusted down to not be divisible by align_grain
      # and then the extra size would be actually sligthly bigger than reported.
      # But being pessimistic is good here because we don't want to enforce that
      # situation.
      # @see #enforced_last
      #
      # @return [DiskSize]
      def extra_size
        disk_size - DiskSize.sum(partitions.map(&:min), rounding: align_grain)
      end

      # Usable space available in addition to the target, taking into account
      # the overhead introduced by data structures
      #
      # @see #usable_size
      # @return [DiskSize]
      def usable_extra_size
        usable_size - DiskSize.sum(partitions.map(&:min))
      end

      # Space that can be distributed among the planned volumes.
      #
      # Substracts from the total the space that will be used by new data
      # structures, like the EBRs of the planned logical partitions
      # See https://en.wikipedia.org/wiki/Extended_boot_record
      #
      # @return [DiskSize]
      def usable_size
        return disk_size if num_logical.zero?

        logical = num_logical
        # If this space is inside an already existing extended partition,
        # libstorage has already substracted the the overhead of the first EBR.
        logical -= 1 if partition_type == :logical
        disk_size - (overhead_of_logical * logical)
      end

      # Total size needed to actually allocate all the assigned planned partitions
      # in the space, no matter what the real size of the space is
      #
      # Used when resizing existing partitions to make space.
      #
      # @return [DiskSize]
      def total_needed_size
        result = DiskSize.sum(partitions.map(&:min), rounding: align_grain)
        # FIXME: since the overhead of the first logical is already substracted
        # by the library, it may be that in some corner cases we are requesting
        # 1 MiB more than strictly needed. For the time being, let's live with
        # that (not a big deal anyway).
        result + (overhead_of_logical * num_logical)
      end

      # Missing size needed to actually allocate all the assigned planned
      # partitions in the space
      #
      # Used when resizing existing partitions to make space.
      #
      # @return [DiskSize]
      def total_missing_size
        if disk_space.disk_size >= total_needed_size
          DiskSize.zero
        else
          total_needed_size - disk_space.disk_size
        end
      end

      # Space that can be sustracted from the start of the region without invalidating this
      # valid assignation
      #
      # @return [DiskSize]
      def disposable_size
        # FIXME: This is more based on trial and error than on a real rationale
        usable_extra_size - align_grain
      end

      # Space consumed by the EBR of one logical partition in a given disk
      # See https://en.wikipedia.org/wiki/Extended_boot_record
      #
      # Currently, default partition table is GPT, so this method is called only
      # when a msdos partition table already exits. A partition table is ensured
      # to avoid possible issues in case of default partition table type changes.
      #
      # @param disk [#topology]
      # @return [DiskSize]
      def self.overhead_of_logical(disk)
        # In fact, the EBR only takes one block. But since we always propose
        # aligned partitions, that block causes the start of the partition to be
        # moved a whole align grain.
        disk.as_not_empty { disk.partition_table.align_grain }
      end

      # Space consumed by the EBR of one logical partition within this space
      #
      # @return [DiskSize]
      def overhead_of_logical
        @overhead_of_logical ||= AssignedSpace.overhead_of_logical(disk)
      end

      def to_s
        "#<AssignedSpace disk_space=#{disk_space}, partitions=#{partitions}>"
      end

      # @return [Partitionable] Device in which the space is located
      def disk
        @disk ||= @disk_space.disk
      end

      # @return [String] Name of the device in which the space is located
      def disk_name
        @disk_name ||= @disk_space.disk_name
      end

      # @return [Region] Region defining the space in the device
      def region
        @region ||= @disk_space.region
      end

      # @return [DiskSize] Size of the space
      def disk_size
        @disk_size ||= @disk_space.disk_size
      end

      # Recalculates the information about the available space, in case it has been modified
      def update_disk_space
        @region = nil
        @disk_size = nil
        @space_start = nil
        @disk_space = @disk_space.updated_free_space(devicegraph)
      end

      protected

      # Checks whether the disk space is inside an extended partition
      #
      # @return [Boolean]
      def inside_extended?
        return @inside_extended unless @inside_extended.nil?

        @inside_extended =
          if extended_partition
            extended_partition.region.start <= space_start && extended_partition.region.end > space_start
          else
            false
          end
      end

      # @return [Integer] Start of the space
      def space_start
        @space_start ||= region.start
      end

      # @return [Partition, nil] Extended partition in the disk, if any
      def extended_partition
        return @extended_partition if @extended_partition_memoized

        @extended_partition_memoized = true
        @extended_partition = disk.partitions.detect { |p| p.type.is?(:extended) }
      end

      # Grain for alignment
      # @see FreeDiskSpace#align_grain
      #
      # @return [DiskSize]
      def align_grain
        @align_grain ||= disk_space.align_grain
      end

      # Whether the partitions should be end-aligned.
      # @see Y2Storage::FreeDiskSpace#require_end_alignment?
      #
      # @return [Boolean]
      def require_end_alignment?
        return @require_end_alignment unless @require_end_alignment.nil?

        @require_end_alignment = disk_space.require_end_alignment?
      end

      # Whether there are too many partitions to allocate in a space that
      # belongs to a reused partition
      #
      # @return [Boolean] false if the space is not a reused partition
      def wrong_usage_of_reused_partition?
        return false unless disk_space.reused_partition?

        partitions.size > 1
      end

      # Whether the planned partitions that must be primary are indeed being to
      # be created as primary partitions.
      #
      # @see Planned::Partition#primary
      #
      # @return [Boolean]
      def primary_partitions_fit?
        # We always create the logical partitions at the end of the space
        logical_parts = partitions.last(num_logical)
        logical_parts.none?(&:primary)
      end

      # Sorts the planned partitions in the most convenient way in order to
      # create real partitions for them.
      def sort_partitions!
        # Initially this was sorting by :disk and :max_start_offset. But
        # since the partitions are already assigned to a given space, using
        # :disk makes very little sense. And it was causing undesired effects
        # (see bsc#1073680 and bsc#1076851).
        @partitions = partitions_sorted_by_attr(:max_start_offset)
        last = enforced_last
        return unless last

        @partitions.delete(last)
        @partitions << last
      end

      # Returns the planned partition that must be placed at the end of a given
      # space in order to make all the partitions fit there.
      #
      # This method only returns something meaningful if the only way to make the
      # partitions fit into the space is ensuring that a particular one will be at
      # the end. That corner case can only happen if the size of the given spaces
      # is not divisible by align_grain.
      #
      # If the volumes fit in any order or if it's impossible to make them fit,
      # the method returns nil.
      #
      # @return [Planned::Partition, nil]
      def enforced_last
        # It's impossible to fit if end-alignment is required
        return nil if require_end_alignment?

        rounded_up = DiskSize.sum(partitions.map(&:min), rounding: align_grain)
        # There is enough space to fit with any order
        return nil if usable_size >= rounded_up

        missing = rounded_up - usable_size
        # It's impossible to fit
        return nil if missing >= align_grain

        # Original partitions order is tried to be modified as less as possible.
        # For that, candidates to place as last partition are searched starting
        # from the end of the list of partitions.
        partitions.reverse.detect do |partition|
          partition.min_size.ceil(align_grain) - missing >= partition.min_size
        end
      end

      # @return [Devicegraph] devicegraph in which the space is defined
      def devicegraph
        disk_space.disk.devicegraph
      end

      def partitions_sorted_by_attr(*attrs, nils_first: false, descending: false)
        partitions.each_with_index.sort do |one, other|
          compare(one, other, attrs, nils_first, descending)
        end.map(&:first)
      end

      # @param one [Array] first element: the partition, second: its original index
      # @param other [Array] same structure than previous one
      def compare(one, other, attrs, nils_first, descending)
        one_part = one.first
        other_part = other.first
        result = compare_attr(one_part, other_part, attrs.first, nils_first, descending)
        if result.zero?
          if attrs.size > 1
            # Try next attribute
            compare(one, other, attrs[1..-1], nils_first, descending)
          else
            # Keep original order by checking the indexes
            one.last <=> other.last
          end
        else
          result
        end
      end

      # @param one [Planned::Partition]
      # @param other [Planned::Partition]
      def compare_attr(one, other, attr, nils_first, descending)
        one_value = one.send(attr)
        other_value = other.send(attr)
        if one_value.nil? || other_value.nil?
          compare_with_nil(one_value, other_value, nils_first)
        else
          compare_values(one_value, other_value, descending)
        end
      end

      # @param one [Planned::Partition]
      # @param other [Planned::Partition]
      def compare_values(one, other, descending)
        if descending
          other <=> one
        else
          one <=> other
        end
      end

      # @param one [Planned::Partition]
      # @param other [Planned::Partition]
      def compare_with_nil(one, other, nils_first)
        if one.nil? && other.nil?
          0
        elsif nils_first
          one.nil? ? -1 : 1
        else
          one.nil? ? 1 : -1
        end
      end
    end
  end
end
