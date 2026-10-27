# Copyright (c) [2026] SUSE LLC
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

require "y2storage/proposal/lvm_space_strategies/base"

module Y2Storage
  module Proposal
    module LvmSpaceStrategies
      # Strategy used by the Agama proposal to make space in a existing LVM volume group
      #
      # This used the same rationale and general rules than the corresponding SpaceMaker strategy.
      class BiggerResize < Base
        # Makes space for planned logical volumes
        #
        # @see Base#provide_space
        def provide_space
          delete_mandatory
          shrink_mandatory
          return if done?

          shrink_optional
          return if done?

          delete_optional
          return if done?

          error_msg = "The volume group #{volume_group.vg_name} is not big enough"
          raise NoDiskSpaceError, error_msg
        end

        private

        # Whether the goal has been achieved
        #
        # @return [Boolean]
        def done?
          missing_vg_space <= DiskSize.zero
        end

        # Executes the mandatory delete actions
        def delete_mandatory
          each_action(:delete) do |action, lv|
            next unless action.mandatory

            volume_group.delete_lvm_lv(lv)
          end
        end

        # Executes the mandatory shrink actions
        def shrink_mandatory
          each_action(:resize) do |action, lv|
            next unless action.max_size
            next if lv.size <= action.max_size

            lv.resize(action.max_size)
          end
        end

        # Shrinks logical volumes as needed to make enough space for the new volumes
        def shrink_optional
          candidates = calculate_optional_shrinks
          until done? || candidates.empty?
            shrink = candidates.pop
            recover = [missing_vg_space, shrink[:recoverable]].min
            shrink[:lv].resize(shrink[:lv].size - recover)
          end
        end

        # Deletes logical volumes as needed to make enough space for the new volumes
        def delete_optional
          candidates = calculate_optional_delete_lvs
          until done? || candidates.empty?
            lv = delete_candidate(candidates)
            candidates.delete(lv)
            volume_group.delete_lvm_lv(lv)
          end
        end

        # @see #shrink_optional
        def calculate_optional_shrinks
          shrinks = []
          each_action(:resize) do |action, lv|
            next if min_for(action) && min_for(action) > lv.size
            next if max_for(action) && max_for(action) < lv.size
            # Resizing a thin volume would not get us any closer to our goal
            next if lv.lv_type.is?(:thin)

            shrinks << {
              lv:          lv,
              recoverable: recoverable_size(lv, action)
            }
          end

          shrinks.sort { |a, b| preferred_shrink(a, b) }
        end

        # Compares two shrinking operations to decide which one should be executed first
        #
        # @return [Integer] -1, 0, or 1 just like the <=> ruby operator
        def preferred_shrink(shrink1, shrink2)
          result = shrink1[:recoverable] <=> shrink2[:recoverable]
          return result unless result.zero?

          # Just to ensure stable sorting between different executions in case of draw
          shrink1[:lv].name <=> shrink2[:lv].name
        end

        # Max space that can be recovered from the given volume, having into account the
        # restrictions imposed by its Resize action
        #
        # @see #shrink_optional
        #
        # @return [DiskSize]
        def recoverable_size(lv, resize)
          min = min_for(resize)
          recoverable = lv.recoverable_size.floor(volume_group.extent_size)
          return recoverable if min.nil? || min > lv.size

          [recoverable, lv.size - min].min
        end

        # @see #delete_optional
        #
        # @return [Array<LvmLv>]
        def calculate_optional_delete_lvs
          lvs = []
          each_action(:delete) do |action, lv|
            next if action.mandatory
            # Deleting a thin volume does not recover any useful space
            next if lv.lv_type.is?(:thin)

            lvs << lv
          end
          lvs
        end

        # Iterates over the actions of the given type
        #
        # @param type [:delete, :resize]
        def each_action(type)
          space_settings.public_send(:"#{type}_actions").each do |action|
            lv = lv_for(action)
            next unless lv

            yield(action, lv)
          end
        end

        # Logical volume associated to a given space action
        #
        # @param action [SpaceActions::Base]
        # @return [LvmLv]
        def lv_for(action)
          volume_group.all_lvm_lvs.find { |v| v.name == action.device }
        end

        # Rounded min size for the resize action, if any
        #
        # Used to ensure all operations fit the extent size of the volume group
        #
        # @param action [SpaceActions::Resize]
        # @return [DiskSize, nil]
        def min_for(action)
          action.min_size ? action.min_size.ceil(volume_group.extent_size) : nil
        end

        # Rounded max size for the resize action, if any
        #
        # Used to ensure all operations fit the extent size of the volume group
        #
        # @param action [SpaceActions::Resize]
        # @return [DiskSize, nil]
        def max_for(action)
          action.max_size ? action.max_size.floor(volume_group.extent_size) : nil
        end
      end
    end
  end
end
