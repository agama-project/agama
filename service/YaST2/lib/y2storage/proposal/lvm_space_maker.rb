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

require "y2storage/proposal/lvm_space_strategies"

module Y2Storage
  module Proposal
    # Class to provide free space in a volume group by resizing and deleting pre-existing logical
    # volumes. Analogous to what SpaceMaker does with partitions.
    class LvmSpaceMaker
      include Yast::Logger

      # Strategies to use to find space. Equivalent to the corresponding SpaceMaker strategies.
      STRATEGIES = {
        auto:          LvmSpaceStrategies::Auto,
        bigger_resize: LvmSpaceStrategies::BiggerResize
      }
      private_constant :STRATEGIES

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

        if STRATEGIES[strategy]
          @strategy_class = STRATEGIES[strategy]
        else
          err_msg = "Unsupported LVM strategy to make space: #{strategy}"
          log.error err_msg
          raise ArgumentError, err_msg
        end
      end

      # Makes space for planned logical volumes
      #
      # This method modifies the volume group received as first argument.
      def provide_space
        log.info "Making space at LVM volume group with strategy #{strategy}"
        log.info "vg: #{@volume_group.name}, planned: #{@planned_vg.inspect}"
        @strategy_class.new(@volume_group, @planned_vg, @space_settings).provide_space
      end

      private

      # Id of the strategy to be used
      #
      # @return [Symbol]
      def strategy
        return :auto unless @space_settings

        @space_settings.strategy
      end
    end
  end
end
