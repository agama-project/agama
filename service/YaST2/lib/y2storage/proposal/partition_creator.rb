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

require "fileutils"
require "y2storage/planned"
require "y2storage/disk_size"
require "y2storage/proposal/creator_result"

module Y2Storage
  module Proposal
    # Class to create partitions following a given distribution represented by
    # a Planned::PartitionsDistribution object
    class PartitionCreator
      include Yast::Logger

      # Initialize.
      #
      # @param original_graph [Devicegraph] initial devicegraph
      def initialize(original_graph)
        @original_graph = original_graph
      end

      # Returns a copy of the original devicegraph in which all the needed
      # partitions have been created.
      #
      # @param distribution [Planned::PartitionsDistribution]
      # @return [CreatorResult]
      def create_partitions(distribution)
        self.devicegraph = original_graph.duplicate

        devices_map = distribution.spaces.reduce({}) do |devices, space|
          new_devices = process_free_space(
            space.disk_space, space.partitions, space.usable_size, space.num_logical
          )
          devices.merge(new_devices)
        end

        CreatorResult.new(devicegraph, devices_map)
      end

      private

      # Working devicegraph
      attr_accessor :devicegraph
      attr_reader :original_graph

      # Create partitions in a single slot of free disk space.
      #
      # @param free_space [FreeDiskSpace] the slot
      # @param partitions [Array<Planned::Partition>] partitions to create
      # @param usable_size [DiskSize] real space to distribute among the planned
      #       partitions (part of free_space could be used for data structures)
      # @param num_logical [Integer] how many partitions should be logical
      def process_free_space(free_space, partitions, usable_size, num_logical)
        partitions.each do |p|
          log.info "partition #{p.mount_point}\tmin: #{p.min}\tmax: #{p.max}\tweight: #{p.weight}"
        end

        align_grain = free_space.align_grain
        end_alignment = free_space.require_end_alignment?

        partitions = Planned::Partition.distribute_space(
          partitions,
          usable_size,
          align_grain:   align_grain,
          end_alignment: end_alignment
        )

        create_planned_partitions(partitions, free_space, num_logical)
      end

      # Creates a partition and the corresponding filesystem for each planned
      # partition
      #
      # @raise an error if a partition cannot be allocated
      #
      # It tries to honor the value of #max_start_offset for each partition, but
      # it does not raise an exception if that particular requirement is
      # impossible to fulfill, since it's usually more a recommendation than a
      # hard limit.
      #
      # @param planned_partitions [Array<Planned::Partition>]
      # @param initial_free_space [FreeDiskSpace]
      # @param num_logical [Symbol] logical partitions. See {#process_space}
      # @return [Hash<String,Planned::Partition>] Planned partitions indexed by the
      #   device name where they were placed
      def create_planned_partitions(planned_partitions, initial_free_space, num_logical)
        devices_map = {}
        planned_partitions.each_with_index do |part, idx|

          space = initial_free_space.updated_free_space(devicegraph)
          primary = planned_partitions.size - idx > num_logical
          partition = create_partition(part, space, primary)
          part.format!(partition)
          devices_map[partition.name] = part
          devicegraph.check
        rescue ::Storage::Exception => e
          raise Error, "Error allocating #{part}. Details: #{e}"

        end
        devices_map
      end

      # Create a real partition for the specified planned partition within the
      # specified slot of free space.
      #
      # @param planned_partition [Planned::Partition]
      # @param free_space   [FreeDiskSpace]
      # @param primary      [Boolean] whether the partition should be primary
      #                     or logical
      def create_partition(planned_partition, free_space, primary)
        log.info "Creating partition for #{planned_partition.mount_point} with #{planned_partition.size}"
        ptable = free_space.disk.ensure_partition_table

        if ptable.type.is?(:implicit)
          reuse_implicit_partition(ptable)
        elsif primary
          create_primary_partition(planned_partition, free_space)
        elsif !ptable.has_extended?
          create_extended_partition(free_space)
          free_space = free_space.updated_free_space(devicegraph)
          create_logical_partition(planned_partition, free_space)
        else
          create_logical_partition(planned_partition, free_space)
        end
      end

      # Reuses the single partition of an implicit partition table instead of creating a new one
      #
      # @raise [Y2Storage::NoMorePartitionSlotError] if the single implicit partition is
      #   already in use.
      #
      # @param ptable [Y2Storage::PartitionTables::ImplicitPt]
      # @return [Y2Storage::Partition] single implicit partition
      def reuse_implicit_partition(ptable)
        partition = ptable.partition
        return partition unless implicit_partition_in_use?(partition)

        raise NoMorePartitionSlotError, "Trying to reuse a not empty implicit partition"
      end

      # Whether a single implicit partition is in use (has filesystem, is an LVM PV, or is
      # part of a software RAID)
      #
      # @param partition [Y2Storage::Partition] single implicit partition
      # @return [Boolean]
      def implicit_partition_in_use?(partition)
        partition.has_children?
      end

      # Creates a primary partition
      #
      # @param planned_partition [Planned::Partition]
      # @param free_space [FreeDiskSpace]
      def create_primary_partition(planned_partition, free_space)
        ptable = free_space.disk.ensure_partition_table
        raise NoMorePartitionSlotError if ptable.max_primary?

        create_not_extended_partition(planned_partition, free_space, PartitionType::PRIMARY)
      end

      # Creates a logical partition
      #
      # @param planned_partition [Planned::Partition]
      # @param free_space [FreeDiskSpace]
      def create_logical_partition(planned_partition, free_space)
        ptable = free_space.disk.ensure_partition_table
        raise NoMorePartitionSlotError if ptable.max_logical?

        create_not_extended_partition(planned_partition, free_space, PartitionType::LOGICAL)
      end

      # Creates a not extended (primary or logical) partition
      #
      # @param planned_partition [Planned::Partition]
      # @param free_space [FreeDiskSpace]
      # @param type [PartitionType] PartitionType::PRIMARY or PartitionType::LOGICAL
      def create_not_extended_partition(planned_partition, free_space, type)
        ptable = free_space.disk.ensure_partition_table

        slot = ptable.unused_slot_for(free_space.region)
        raise Error if slot.nil?

        region = new_region_with_size(free_space.region, planned_partition.size)

        partition = ptable.create_partition(slot.name, region, type)
        partition.adapted_id = partition_id(planned_partition)
        partition.boot = !!planned_partition.bootable if ptable.partition_boot_flag_supported?
        partition
      end

      # Creates an extended partition
      #
      # @param free_space [FreeDiskSpace]
      def create_extended_partition(free_space)
        ptable = free_space.disk.ensure_partition_table

        slot = ptable.unused_slot_for(free_space.region)
        raise NoMorePartitionSlotError if slot.nil?

        ptable.create_partition(slot.name, free_space.region, PartitionType::EXTENDED)
      end

      # Create a new region from the given one, but with new size.
      #
      # @param region [Region] initial region
      # @param size [DiskSize] new size of the region
      #
      # @return [Region] Newly created region
      #
      def new_region_with_size(region, size)
        blocks = (size / region.block_size.to_i).to_i
        # Never exceed the region
        blocks = region.end - region.start + 1 if region.start + blocks > region.end
        Region.create(region.start, blocks, region.block_size)
      end

      # Returns the partition id that should be used for a new partition in
      # a specific partition table.
      #
      # @param planned_partition [Planned::Partition]
      #
      # @return [PartitionId]
      def partition_id(planned_partition)
        partition_id = planned_partition.partition_id
        return partition_id if partition_id

        if planned_partition.mount_point == "swap"
          PartitionId::SWAP
        else
          PartitionId::LINUX
        end
      end
    end
  end
end
