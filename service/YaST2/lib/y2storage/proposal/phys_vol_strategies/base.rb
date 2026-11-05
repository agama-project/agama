# Copyright (c) [2015-2019] SUSE LLC
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
require "y2storage/planned"

module Y2Storage
  module Proposal
    module PhysVolStrategies
      # Base class for all physical volume strategies
      class Base
        include Yast::Logger

        # Initialize.
        #
        # @param distribution [Planned::PartitionsDistribution] initial
        #     distribution
        # @param all_spaces [Array<FreeDiskSpace>] Disk spaces that could
        #     potentially contain physical volumes
        # @param planned_vg [Planned::LvmVg] volume group to create the PVs for
        def initialize(distribution, all_spaces, planned_vg)
          @initial_distribution = distribution
          @all_spaces = all_spaces
          @planned_vg = planned_vg
        end

        # Extended distribution that includes a planned partition for every
        # physical volumes that would be necessary to fulfill the LVM requirements
        #
        # @see PhysVolCalculator#add_physical_volumes
        #
        # @return [Planned::PartitionsDistribution, nil] nil if it's
        #     impossible to allocate all the needed physical volumes
        def add_physical_volumes
          best = nil

          space_combinations.each do |candidate_spaces|
            log.debug "Adding PVs: check #{candidate_spaces}"
            if !worth_checking?(candidate_spaces)
              log.debug "Adding PVs: combination skipped"
              next
            end
            candidate = processed_distribution(candidate_spaces)
            next unless candidate

            best = candidate if !best || candidate.better_than(best) < 0
          end

          best
        end

        protected

        # @return [Planned::LvmVg]
        attr_reader :planned_vg

        # @return [Array<FreeDiskSpace>] Disk spaces that could potentially
        #   contain physical volumes
        attr_reader :all_spaces

        # @return [Planned::PartitionsDistribution]
        attr_reader :initial_distribution

        # Max size for new partition in a given free space, taking into account the
        # restrictions imposed by the initial distribution
        #
        # If the space is marked as :primary or :logical, this method returns the
        # exact available size. If partition_type is nil there is still a chance
        # of logical overhead. But since it cannot be known in advance, the method
        # returns an optimistic estimation.
        #
        # @param space [FreeDiskSpace]
        # @return [DiskSize]
        def estimated_available_size(space)
          assigned_space = initial_distribution.space_at(space)
          return space.disk_size unless assigned_space

          size = assigned_space.extra_size
          size -= assigned_space.overhead_of_logical if assigned_space.partition_type == :logical
          size
        end

        # Useful LVM space provided by all the physical volumes in a given
        # distribution
        #
        # @param distribution [Planned::PartitionsDistribution]
        # @return [DiskSize]
        def potential_lvm_size(distribution)
          total = DiskSize.zero
          distribution.spaces.each do |space|
            pv_partition = new_pv_at(space)
            next unless pv_partition

            usable_size = potential_partition_size(pv_partition, space)
            total += planned_vg.useful_pv_space(usable_size)
          end
          total
        end

        # Maximum size a given planned partition can reach within its assigned
        # space
        #
        # @param partition [Planned::Partition]
        # @param space [Planned::AssignedSpace] space to which the partition is
        #   assigned
        # @return [DiskSize]
        def potential_partition_size(partition, space)
          @potential_part_sizes ||= {}
          @potential_part_sizes[partition] ||= space.usable_extra_size + partition.min_size
        end

        # Planned partition that will hold an LVM PV of the planned volume group
        #
        # @param space [Planned::AssignedSpace]
        # @return [Planned::Partition]
        def new_pv_at(space)
          space.partitions.find do |part|
            part.lvm_pv? && part.lvm_volume_group_name == planned_vg.volume_group_name
          end
        end

        # Subset of #all_spaces that are worth considering to allocate planned
        # physical volumes
        #
        # @return [Array<Planned::AssignedSpace>]
        def useful_spaces
          @useful_spaces ||= all_spaces.select do |space|
            available_size = estimated_available_size(space)
            available_size >= planned_vg.min_pv_size
          end
        end

        # Space that can be used for LVM in a given assigned space
        #
        # @param space [Planned::AssignedSpace]
        # @return [DiskSize]
        def useful_size(space)
          @useful_sizes ||= {}
          @useful_sizes[space] ||= planned_vg.useful_pv_space(estimated_available_size(space))
        end

        # Planned partition representing a LVM physical volume with the minimum
        # possible size
        #
        # @return [Planned::Partition]
        def new_planned_partition
          planned_vg.minimal_pv_partition
        end

        # Adjust the weights of all the planned partitions in the distribution that
        # were created to represent a LVM physical volume.
        #
        # @param distribution [Planned::PartitionsDistribution]
        def adjust_weights(distribution)
          distribution.spaces.each do |space|
            pv_partition = new_pv_at(space)
            next unless pv_partition

            other_partitions = space.partitions.reject { |v| v == pv_partition }
            pv_partition.weight = other_partitions.map(&:weight).reduce(0, :+)
            pv_partition.weight = 1 if pv_partition.weight.zero?
          end
        end
      end
    end
  end
end
