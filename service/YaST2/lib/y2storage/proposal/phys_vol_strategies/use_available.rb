# Copyright (c) [2018] SUSE LLC
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

require "y2storage/proposal/phys_vol_strategies/base"

module Y2Storage
  module Proposal
    module PhysVolStrategies
      # Strategy to create LVM physical volumes when the value of
      # lvm_vg_strategy is :use_available
      class UseAvailable < Base
        protected

        # Combinations of assigned spaces to be evaluated, in principle, when
        # looking for the right places to locate the new physical volumes
        #
        # @return [Array<Array<Planned::AssignedSpace>>] the sets with more
        #   assigned spaces come first, because if they succeed there is no
        #   point in checking any other combination
        def space_combinations
          useful_spaces.size.downto(1).each_with_object([]) do |size, result|
            result.concat(useful_spaces.combination(size).to_a)
          end
        end

        # Returns a new PartitionsDistribution created by adding physical
        # volumes to as many spaces as possible.
        #
        # Returns nil if it's not possible to create a distribution of physical
        # volumes that guarantees the requirements set by the planned VG.
        #
        # @param spaces [Array<FreeDiskSpace>]
        # @return [Planned::PartitionsDistribution, nil]
        def processed_distribution(spaces)
          pv_partitions = spaces.each_with_object({}) do |space, pvs|
            pvs[space] = new_planned_partition
          end

          begin
            result = initial_distribution.add_partitions(pv_partitions)
          rescue StandardError
            # Adding PVs in this way leads to an invalid distribution
            return nil
          end

          adjust_sizes(result)
          remember_combination(spaces)

          sizes = pv_partitions.values.map { |part| planned_vg.useful_pv_space(part.min_size) }
          return nil if DiskSize.sum(sizes) < planned_vg.missing_space

          adjust_weights(result)
          result
        end

        # Whether the current combination of spaces needs to be checked
        #
        # If the current combination is a subset of another combination that
        # already produced a successful distribution, there is no point in
        # checking the current one, it will result in an smaller LVM for sure.
        #
        # @param spaces [Array<Planned::AssignedSpace>]
        # @return [Boolean]
        def worth_checking?(spaces)
          # Since we are on it, it's quick and easy to pre-discard combinations that
          # will result for sure in too small LVM space.
          #
          # This check is NOT redundant to the one at the end of #processed_distibution.
          # This one is optimistic, the other one is realistic (so still needed
          # in some corner cases).
          useful_sizes = spaces.map { |s| useful_size(s) }
          return false if DiskSize.sum(useful_sizes) < planned_vg.missing_space

          return true if @checked_combinations.nil?

          @checked_combinations.none? do |checked|
            redundant?(spaces, checked)
          end
        end

        # @see #worth_checking?
        def redundant?(new_list, checked)
          (new_list - checked).empty?
        end

        # @see #worth_checking?
        def remember_combination(spaces)
          @checked_combinations ||= []
          @checked_combinations << spaces
        end

        # Adjust the sizes of all the partitions in the distribution that
        # were created to represent a LVM physical volume.
        #
        # @param distribution [Planned::PartitionsDistribution]
        def adjust_sizes(distribution)
          distribution.spaces.each do |space|
            pv = new_pv_at(space)
            next unless pv

            # If this space is not big enough to ensure all the LVM space, them reclaim it all
            pv.min_size = [needed_in_single_pv, potential_partition_size(pv, space)].min
            pv.max_size = DiskSize.unlimited
          end
        end

        # Size that a single physical volume would need to have in order to
        # satisfy the LVM requirements by itself
        #
        # @return [DiskSize]
        def needed_in_single_pv
          @needed_in_single_pv ||= planned_vg.real_pv_size(planned_vg.missing_space)
        end
      end
    end
  end
end
