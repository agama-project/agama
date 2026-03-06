# frozen_string_literal: true

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

require "agama/storage/config_solvers/devices_search"
require "agama/storage/config_solvers/search_matchers"

module Agama
  module Storage
    module ConfigSolvers
      # Solver for the search of the logical volume configs.
      class LogicalVolumesSearch < DevicesSearch
        include SearchMatchers

        # Solves the search of the logical volume configs.
        #
        # @note The config object is modified.
        #
        # @param config [Configs::VolumeGroup]
        # @return [Configs::VolumeGroup]
        def solve(config)
          candidate_lvs = config.found_device&.all_lvm_lvs || []
          config.logical_volumes = super(config.logical_volumes, candidate_lvs)
          config
        end

      private

        # @see DevicesSearch#match_condition?
        # @param lv_config [Configs::LogicalVolume]
        # @param lvm_lv [Y2Storage::LvmLv]
        #
        # @return [Boolean]
        def match_condition?(lv_config, lvm_lv)
          match_name?(lv_config, lvm_lv) && match_size?(lv_config, lvm_lv)
        end

        # @see DevicesSearch#solve_with_device
        def solve_with_device(device_config, device)
          result = super
          result.pool = result.found_device.lv_type.is?(:thin_pool)
          result.name = result.found_device.lv_name
          result
        end
      end
    end
  end
end
