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

require "y2storage/proposal/phys_vol_strategies"

module Y2Storage
  module Proposal
    # Class used by PartitionsDistributionCalculator to find the best
    # distribution of LVM physical volumes.
    class PhysVolCalculator
      include Yast::Logger

      STRATEGIES = {
        use_needed:    PhysVolStrategies::UseNeeded,
        use_available: PhysVolStrategies::UseAvailable
      }

      # Initialize.
      #
      # @param all_spaces [Array<FreeDiskSpace>] Disk spaces that could
      #     potentially contain physical volumes for the given volume group
      # @param planned_vg [Planned::LvmVg] volume group to create the PVs for
      def initialize(all_spaces, planned_vg)
        @planned_vg = planned_vg
        @all_spaces = all_spaces

        strategy = planned_vg.size_strategy
        if STRATEGIES[strategy]
          @strategy_class = STRATEGIES[strategy]
        else
          err_msg = "Unsupported LVM strategy: #{strategy}"
          log.error err_msg
          raise ArgumentError, err_msg
        end
      end

      # Extended distribution that includes a planned partition for every
      # physical volumes that would be necessary to fulfill the LVM requirements
      #
      # @note This is delegated to one of the existing strategy classes in the
      #   {PhysVolStrategies} namespace. The concrete class is decided based on
      #   the `lvm_vg_strategy` attribute of the proposal settings.
      #
      # @param distribution [Planned::PartitionsDistribution] initial
      #     distribution
      # @return [Planned::PartitionsDistribution, nil] nil if it's
      #     impossible to allocate all the needed physical volumes
      def add_physical_volumes(distribution)
        @strategy_class.new(distribution, @all_spaces, @planned_vg).add_physical_volumes
      end
    end
  end
end
