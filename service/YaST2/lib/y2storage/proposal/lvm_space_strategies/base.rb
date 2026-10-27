# Copyright (c) [2017-2026] SUSE LLC
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

require "y2storage/disk_size"

module Y2Storage
  module Proposal
    module LvmSpaceStrategies
      # Base class for the LVM space strategies
      class Base
        include Yast::Logger

        # Constructor
        #
        # @param volume_group [LvmVg] volume group to clean-up
        # @param planned_vg   [Planned::LvmVg] planned logical volume
        # @param space_settings [ProposalSpaceSettings, nil] Optional settings. See
        #   {LvmCreator#initialize}.
        def initialize(volume_group, planned_vg, space_settings)
          @volume_group = volume_group
          @planned_vg = planned_vg
          @space_settings = space_settings
        end

        # Makes space for planned logical volumes
        #
        # This method modifies the volume group assigned to the strategy object.
        #
        def provide_space
          raise NotImplementedError
        end

        private

        # @return [LvmVg] volume group to clean-up
        attr_reader :volume_group

        # @return [Planned::LvmVg] planned logical volume
        attr_reader :planned_vg

        # @return [ProposalSpaceSettings] settings to make space
        attr_reader :space_settings

        # Space that needs to be available in order to be able to create the volumes
        #
        # @return [DiskSize]
        def target_space
          @target_space ||= DiskSize.sum(
            relevant_planned_lvs.map(&:min_size),
            rounding: volume_group.extent_size
          )
        end

        # Planned logical volumes to take into account when calculating the target space
        #
        # @see #target_space
        #
        # @return [Array<Planned::LvmLv>]
        def relevant_planned_lvs
          planned_vg.lvs.reject(&:reuse?).reject { |v| v.lv_type.is?(:thin) }
        end

        # Missing space in the volume group to fullfil the target
        #
        # @return [DiskSize]
        def missing_vg_space
          available = volume_group.available_space
          if available > target_space
            DiskSize.zero
          else
            target_space - available
          end
        end

        # Best logical volume to delete next while trying to make space for the
        # planned volumes. It returns the smallest logical volume that would
        # fulfill the goal. If no LV is big enough, it returns the biggest one.
        def delete_candidate(lvs)
          big_lvs = lvs.select { |lv| lv.size >= missing_vg_space }
          if big_lvs.empty?
            lvs.max_by(&:size)
          else
            big_lvs.min_by(&:size)
          end
        end
      end
    end
  end
end
