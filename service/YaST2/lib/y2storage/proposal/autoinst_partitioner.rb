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
require "y2storage/proposal/autoinst_partition_size"

module Y2Storage
  module Proposal
    # Class to create and reuse partitions in any given devicegraph, based on
    # planned devices with an AutoYaST specification of the sizes.
    class AutoinstPartitioner
      include Yast::Logger
      include AutoinstPartitionSize

      # Constructor
      #
      # @param devicegraph [Devicegraph] see {#devicegraph}
      def initialize(devicegraph)
        @devicegraph = devicegraph
      end

      # Reuses partitions in the target devicegraph
      #
      # @param reused_parts  [Array<Planned::Partition>] Partitions to reuse
      def reuse_partitions(reused_parts)
        reuse_partitions_in_devicegraph(reused_parts, devicegraph)
      end

      # Reuses existing partitions of the given planned device
      #
      # @note This method does not modify the original devicegraph but returns
      #   a new copy containing the changes.
      #
      # @param planned_device [Planned::Device] partitionable planned device
      # @return [CreatorResult] result containing the reused partitions
      def reuse_device_partitions(planned_device)
        new_graph = devicegraph.duplicate
        planned_device.reuse!(new_graph)
        device = new_graph.find_by_name(planned_device.reuse_name)

        reused_parts = sized_partitions(planned_device.partitions.select(&:reuse?), device: device)
        reuse_partitions_in_devicegraph(reused_parts, new_graph)

        CreatorResult.new(new_graph, {})
      end

      # Creates partitions within a set of devices
      #
      # @param planned_partitions [Array<Planned::Partition>] List of planned partitions to create
      # @param partitionables     [Array<Partitionable>] devices to partition
      # @return [CreatorResult] Result of creating the partitions
      #
      # @raise NoDiskSpaceError
      def create_partitions(planned_partitions, partitionables)
        log.info "Partitions to create: #{planned_partitions}"
        primary, non_primary = planned_partitions.partition(&:primary)
        parts_to_create = primary + non_primary

        dist = best_distribution(parts_to_create, partitionables)
        if dist.nil?
          log.error "Partitions cannot be allocated:"
          log.error "  devices: #{partitionables}"
          log.error "  partitions: #{planned_partitions}"
          raise NoDiskSpaceError, "Partitions cannot be allocated into #{partitionables.map(&:name)}"
        end

        part_creator = Proposal::PartitionCreator.new(devicegraph)
        part_creator.create_partitions(dist)
      end

      # Formats or partitions a device as needed
      #
      # @see #format_device
      # @see #partition_device
      #
      # @param device     [BlkDevice] device to format or partition
      # @param planned_device [Planned::Device] Planned device
      # @return [Proposal::CreatorResult] Result containing the processed device
      def process_device(device, planned_device)
        if planned_device.partitions.empty?
          format_device(device, planned_device)
        else
          partition_device(device, planned_device)
        end
      end

      # Creates partitions in a device and sets up them according to the plan
      #
      # @param device         [Partitionable] device to partition
      # @param planned_device [Planned::Device] Planned device
      # @return [Proposal::CreatorResult] Result containing the partitioned device
      def partition_device(device, planned_device)
        PartitionTableCreator.new.create_or_update(device, planned_device.ptable_type)
        new_partitions = planned_device.partitions.reject(&:reuse?)
        new_partitions = sized_partitions(new_partitions, device: device)
        create_partitions(new_partitions, [device])
      end

      # Formats a block device to be used as a filesystem
      #
      # @param device     [BlkDevice] device to format
      # @param planned_device [Planned::Device] Planned device
      # @return [Proposal::CreatorResult] Result containing the formatted device
      def format_device(device, planned_device)
        planned_device.format!(device) if can_format?(planned_device)
        CreatorResult.new(devicegraph, device.name => planned_device)
      end

      private

      # Devicegraph to operate on
      #
      # @note Unless specified otherwise, all public methods modify this
      #   devicegraph directly
      #
      # @return [Devicegraph]
      attr_reader :devicegraph

      # Reuses partitions for the given devicegraph
      #
      # Shrinking partitions/logical volumes should be processed first in order to free
      # some space for growing ones.
      #
      # @param reused_parts  [Array<Planned::Partition>] Partitions to reuse
      # @param graph [Devicegraph] devicegraph to operate on
      def reuse_partitions_in_devicegraph(reused_parts, graph)
        shrinking, not_shrinking = reused_parts.partition { |d| d.shrink?(graph) }
        (shrinking + not_shrinking).each { |d| d.reuse!(graph) }
      end

      # Finds the best distribution for the given planned partitions
      #
      # @see Proposal::PartitionsDistributionCalculator#best_distribution
      #
      # @param planned_partitions [Array<Planned::Partition>] List of planned partitions to create
      # @param devices            [Array<Partitionable>]
      # @return [PartitionsDistribution] Distribution of partitions
      def best_distribution(planned_partitions, devices)
        spaces = devices.map(&:free_spaces).flatten

        dist = distribute_partitions(planned_partitions, spaces)
        return dist if dist

        # Second try with more flexible planned partitions
        distribute_partitions(flexible_partitions(planned_partitions), spaces)
      end

      # @see #best_distribution
      #
      # @param partitions [Array<Planned::Partition>] list of planned partitions to create
      # @param spaces [Array<FreeDiskSpace>] spaces to distribute the partitions
      # @return [Planned::PartitionsDistribution, nil]
      def distribute_partitions(partitions, spaces)
        calculator = Proposal::PartitionsDistributionCalculator.new(partitions)
        calculator.best_distribution(spaces)
      end

      # Checks whether (re)formatting the given device is acceptable
      #
      # @see #format_device
      #
      # @param planned [Planned::Device] planned device
      # @return [Boolean]
      def can_format?(planned)
        # If the device is not going to be reused, #reformat? is irrelevant
        return true unless planned.reuse?

        planned.reformat?
      end
    end
  end
end
