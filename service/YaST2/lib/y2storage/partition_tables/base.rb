# Copyright (c) [2017] SUSE LLC
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
require "y2storage/device"
require "y2storage/partition_tables/type"
require "y2storage/region"
require "y2storage/free_disk_space"
require "y2storage/encryption"

module Y2Storage
  module PartitionTables
    # Base class for the different kinds of partition tables.
    #
    # This is a wrapper for Storage::PartitionTable
    class Base < Device
      wrap_class Storage::PartitionTable,
        downcast_to: [
          "PartitionTables::Msdos",
          "PartitionTables::Gpt",
          "PartitionTables::Dasd",
          "PartitionTables::ImplicitPt"
        ]

      # @!method type
      #   @return [PartitionTables::Type]
      storage_forward :type, as: "PartitionTables::Type"

      storage_forward :storage_create_partition, to: :create_partition, as: "Partition"

      # Creates a new partition.
      #
      # @raise [Storage::DifferentBlockSizes] if the region don't fit the
      #   device
      # @raise [Storage::Exception] if it's impossible to create the partition
      #   for any other reason. @see Partition.create
      #
      # @param [String] name of the device, kernel-style (e.g. "/dev/sda1")
      # @param [Region] region to be used by the new partition
      # @param [PartitionType] type of the new partition
      # @return [Partition]
      def create_partition(name, region, type, *extra_args)
        result = storage_create_partition(name, region, type, *extra_args)
        Encryption.update_dm_names(devicegraph)
        result
      end

      storage_forward :storage_delete_partition, to: :delete_partition

      # Deletes the given partition in the partition table and all its
      # descendants.
      #
      # @param partition [Partition, String] device or device name
      def delete_partition(partition, *extra_args)
        part_obj =
          if partition.is_a?(String)
            partitions.find { |part| part.name == partition }
          else
            partition
          end

        # Needed to enforce the REMOVE view when deleting descendants
        part_obj&.remove_descendants

        storage_delete_partition(partition, *extra_args)
        Encryption.update_dm_names(devicegraph)
      end

      # @!method partitions
      #   All the partitions, in no particular order
      #   @return [Array<Partition>]
      storage_forward :partitions, as: "Partition"

      # @!method partitionable
      #   @return [Partitionable] device hosting the partition table
      storage_forward :partitionable, as: "Partitionable"

      # @!method max_primary
      #   @return [Integer] maximum supported number of primary partitions
      storage_forward :max_primary

      # @!method num_primary
      #   @return [Integer] current amount of primary partitions
      storage_forward :num_primary

      # @!method max_logical
      #   @return [Integer] maximum supported number of logical partitions
      storage_forward :max_logical

      # @!method num_logical
      #   @return [Integer] current amount of logical partitions
      storage_forward :num_logical

      # @!method extended_possible?
      #   @return [Boolean] whether is possible to have an extended partition
      storage_forward :extended_possible?, to: :extended_possible

      # @!method has_extended?
      #   @return [Boolean] whether an extended partition exists in the table
      storage_forward :has_extended?, to: :has_extended

      # rubocop: disable Layout/LineLength
      # @!method unused_partition_slots(policy = AlignPolicy::ALIGN_START_KEEP_END, type = AlignType::OPTIMAL)
      #
      #   Slots that could be used to create new partitions following the
      #   given align policy.
      #
      #   @param policy [AlignPolicy] policy to consider while looking for slots
      #   @param type [AlignType] type of alignment to use
      #   @return [Array<PartitionTables::PartitionSlot>]
      storage_forward :unused_partition_slots, as: "PartitionTables::PartitionSlot"
      # rubocop: enable all

      # @!method partition_boot_flag_supported?
      #   @return [Boolean] whether the partitions in the table can have the
      #     boot flag.
      storage_forward :partition_boot_flag_supported?

      # @!method partition_legacy_boot_flag_supported?
      #   @return [Boolean] whether the partitions in the table can have the
      #     legacy boot flag.
      storage_forward :partition_legacy_boot_flag_supported?

      # @!method partition_id_supported?(id)
      #
      #   @param id [Integer] the partition id
      #
      #   @return [Boolean] whether a partition can have this partition id.
      storage_forward :partition_id_supported?

      # @!method align(region, policy = AlignPolicy::ALIGN_START_AND_END, type = AlignType::OPTIMAL)
      #   Aligns the region according to align policy and align type.
      #
      #   @param region [Region] region to align
      #   @param policy [AlignPolicy] policy to consider while aligning
      #   @param type [AlignType]
      #
      #   @return [Region] always returns a new object
      storage_forward :align, as: "Region"

      # @!method alignment(align_type = AlignType::OPTIMAL)
      #   Low-level object to calculate partition alignment based on hardware
      #   topology.
      #
      #   @param align_type [AlignType] alignment type to use in all the
      #     calculations
      #   @return [Storage::Alignment]
      storage_forward :alignment
      private :alignment

      def inspect
        parts = partitions.map(&:inspect)
        slots = unused_partition_slots.map(&:to_s)
        "<PartitionTable #{self}[#{num_children}] #{parts}#{slots}>"
      end

      # Unused slot that contains a region
      #
      # @param region [Region]
      # @param align_policy [AlignPolicy] policy used to detect the slot
      # @param align_type [AlignType] type used to detect the slot
      # @return [PartitionTables::PartitionSlot, nil] nil when region is not
      #   inside to any unused slot.
      def unused_slot_for(
        region, align_policy: AlignPolicy::ALIGN_START_KEEP_END, align_type: AlignType::OPTIMAL
      )
        unused_partition_slots(align_policy, align_type).detect { |s| region.inside?(s.region) }
      end

      # Whether the partition table contains the maximum number of primary partitions
      #
      # @return [Boolean]
      def max_primary?
        num_primary == max_primary
      end

      # Whether the partition table contains the maximum number of logical partitions
      #
      # @return [Boolean]
      def max_logical?
        num_logical == max_logical
      end

      # Grain for alignment
      #
      # The align grain of a partition table is the size unit that must be
      # used to specify beginning and end of a partition in order to keep
      # everything aligned.
      #
      # @note The align grain is similar to minimal grain for a device, but
      #   it depends on both: the device topology and the partition table
      #   alignment.
      #
      # @param align_type [AlignType, nil] if ommitted, it will use the default
      #   value of {#alignment}
      # @return [DiskSize]
      def align_grain(align_type = nil)
        align_obj = align_type ? alignment(align_type) : alignment
        DiskSize.new(align_obj.grain)
      end

      # Whether the partitions should be end-aligned.
      #
      # Some kind of partition tables, for example DASD, requires end-aligned
      # partitions. In general, this is not required for most of partion tables:
      # MBR or GPT.
      #
      # @return [Boolean] false by default
      def require_end_alignment?
        false
      end

      # The partition id depends on the partition table type. For example,
      #   MSDOS partition tables use SWAP id for swap partitions, but DASD
      #   partiton tables need LINUX id.
      #
      # With this method, each partition table can define the partition id
      #   it really expects for each case.
      #
      # @param partition_id [PartitionId]
      # @return [PartitionId]
      def partition_id_for(partition_id)
        partition_id
      end

      # deletes all partitions in partition table
      def delete_all_partitions
        to_delete = partitions.reject { |p| p.type.is?(:logical) }
        to_delete.each do |partition|
          log.info "deleting #{partition}"
          delete_partition(partition)
        end
      end

      # List of supported partition ids suitable for a particular partition table.
      #
      # @see partition_id_supported?
      #
      # @return [Array<PartitionId>]
      def supported_partition_ids
        PartitionId.all.find_all do |id|
          partition_id_supported?(id) && id != PartitionId::UNKNOWN
        end
      end

      # Aligns the end of a region, leaving the start untouched.
      #
      # The argument max_end can be used to specify the block that limits the
      # partition slot in which the region is located, typically the end of the
      # disk or the start of the next already existing partition.
      #
      # The alignment is skipped if the region ends at the block specified by
      # max_end, which prevents the creation of useless gaps.
      #
      # On the other hand, if the region ends before max_end it means that
      # leaving some space between the region and that limit is intented, so
      # alignment is performed to ensure that remaining space starts in an
      # aligned block
      #
      # @raise [Storage::AlignError] if the region is too small to be aligned
      #
      # @param region [Region] original region to align
      # @param align_type [AlignType]
      # @param max_end [Integer, nil] see description, nil to always align
      # @return [Region] a copy of region with the same start but the end either
      #   equal to max_end or aligned according to align_type
      def align_end(region, align_type = AlignType::OPTIMAL, max_end: nil)
        if region.end == max_end
          # Nothing to change
          region.dup
        else
          align(region, AlignPolicy::KEEP_START_ALIGN_END, align_type)
        end
      end

      # Free spaces in the partition table
      #
      # @note There is a free space for each unused slot.
      #
      # @see FreeDiskSpace
      #
      # @return [Array<Y2Storage::FreeDiskSpace>]
      def free_spaces
        unused_partition_slots.map { |s| FreeDiskSpace.new(partitionable, s.region) }
      end

      protected

      # @see Device#is?
      def types_for_is
        super << :partition_table
      end
    end
  end
end
