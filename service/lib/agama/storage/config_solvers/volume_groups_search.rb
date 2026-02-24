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
require "agama/storage/config_solvers/logical_volumes_search"
require "agama/storage/config_solvers/search_matchers"

module Agama
  module Storage
    module ConfigSolvers
      # Solver for the search of the volume group configs.
      class VolumeGroupsSearch < DevicesSearch
        include SearchMatchers

        # @param storage_system [Storage::System]
        def initialize(storage_system)
          super()
          @storage_system = storage_system
        end

        # Solves the search of the volume group configs and solves the searches of their
        # logical volumes.
        #
        # @note The config object is modified.
        #
        # @param config [Storage::Config]
        # @return [Storage::Config]
        def solve(config)
          config.volume_groups = super(config.volume_groups, storage_system.devicegraph.lvm_vgs)
          config.volume_groups.each { |vg| LogicalVolumesSearch.new.solve(vg) }
          config
        end

      private

        # @return [Storage::System]
        attr_reader :storage_system

        # @see DevicesSearch#match_condition?
        # @param volume_group_config [Configs::VolumeGroup]
        # @param volume_group [Y2Storage::LvmVg]
        #
        # @return [Boolean]
        def match_condition?(volume_group_config, volume_group)
          match_name?(volume_group_config, volume_group) &&
            match_size?(volume_group_config, volume_group)
        end
      end
    end
  end
end
