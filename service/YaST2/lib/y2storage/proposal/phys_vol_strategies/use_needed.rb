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

require "y2storage/proposal/phys_vol_strategies/base"

module Y2Storage
  module Proposal
    module PhysVolStrategies
      # Strategy to create LVM physical volumes when the value of
      # lvm_vg_strategy is :use_needed
      class UseNeeded < Base
        protected

        # Combinations of assigned spaces to be evaluated, in principle, when
        # looking for the right places to locate the new physical volumes
        def space_combinations
          useful_spaces.permutation
        end

        # Returns a new PartitionsDistribution created by assigning a physical
        # volume to each space, following the given order, until the goal is
        # reached.
        #
        # Returns nil if it's not possible to create a distribution of physical
        # volumes that guarantees the requirements set by the planned VG.
        #
        # @param sorted_spaces [Array<FreeDiskSpace>]
        # @return [Planned::PartitionsDistribution, nil]
        def processed_distribution(sorted_spaces)
          pv_partitions = {}
          missing_size = planned_vg.missing_space
          result = nil

          sorted_spaces.each do |space|
            # The key point that can invalidate a solution is the distribution of
            # partitions among free spaces, not so much the size. So let's start
            # with minimal volumes. We will grow them in the end if the
            # distribution is valid.
            pv_partitions[space] = new_planned_partition
            useful_space = useful_size(space)

            if useful_space < missing_size
              # Still not enough, let's assume we will use the whole space
              missing_size -= useful_space
            else
              # This space is, hopefully, the last one we need to fill.
              # Let's consolidate and check if it was indeed enough
              begin
                result = initial_distribution.add_partitions(pv_partitions)
              rescue StandardError
                # Adding PVs in this order leads to an invalid distribution
                return nil
              end
              if potential_lvm_size(result) >= planned_vg.missing_space
                # We did it!
                remember_combination(sorted_spaces, space)
                adjust_sizes(result, space)
                adjust_weights(result)
                break
              else
                # Our estimation was too optimistic. The overhead of logical
                # partitions fooled us. Let's keep trying.
                missing_size -= useful_space
                result = nil
              end
            end
          end

          result
        end

        # Adjust the sizes of all the partitions in the distribution that
        # were created to represent a LVM physical volume.
        #
        # @param distribution [Planned::PartitionsDistribution]
        # @param last_disk_space [FreeDiskSpace] the last space that was added by
        #     #processed is not adjusted to fill as much space as possible, but to
        #     match the total LVM requirements (size and max)
        def adjust_sizes(distribution, last_disk_space)
          missing_size = planned_vg.missing_space

          distribution.spaces.each do |space|
            pv_partition = new_pv_at(space)
            next unless pv_partition
            next if space.disk_space == last_disk_space

            usable_size = potential_partition_size(pv_partition, space)
            pv_partition.min_size = usable_size
            pv_partition.max_size = usable_size
            missing_size -= planned_vg.useful_pv_space(usable_size)
          end

          space = distribution.space_at(last_disk_space)
          pv_partition = new_pv_at(space)
          pv_size = planned_vg.real_pv_size(missing_size)
          pv_partition.min_size = pv_size

          other_pvs_size = planned_vg.missing_space - missing_size
          pv_partition.max_size = planned_vg.real_pv_size(planned_vg.max_extra_space - other_pvs_size)
        end

        def remember_combination(sorted_spaces, final_space)
          final_index = sorted_spaces.index(final_space)
          @checked_combinations ||= []
          @checked_combinations << sorted_spaces[0..final_index]
        end

        # Whether the current combination of spaces needs to be checked or not
        #
        # Many permutations are equivalent since they will produce the exact
        # same PVs in the same places. This method allows to skip those.
        #
        # @param spaces [Array<Planned::AssignedSpace>]
        # @return [Boolean]
        def worth_checking?(spaces)
          return true if @checked_combinations.nil?

          @checked_combinations.none? do |checked|
            redundant?(spaces, checked)
          end
        end

        # @see #worth_checking?
        def redundant?(new_list, checked)
          # For an already tested combination in which X was the last space to
          # get a PV, we can discard all combinations in which X is in the same
          # position and the spaces previous to it are the same (in any order).
          last_pos = checked.size - 1
          return false if checked.last != new_list[last_pos]

          same_first_spaces?(checked, new_list, last_pos)
        end

        # @see #redundant?
        def same_first_spaces?(list1, list2, amount)
          list1 = list1.first(amount)
          list2 = list2.first(amount)
          (list1 - list2).empty? && (list2 - list1).empty?
        end
      end
    end
  end
end
