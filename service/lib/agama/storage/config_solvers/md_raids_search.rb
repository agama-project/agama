# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
require "agama/storage/config_solvers/with_partitions_search"

module Agama
  module Storage
    module ConfigSolvers
      # Solver for the search of the MD RAID configs.
      class MdRaidsSearch < DevicesSearch
        include SearchMatchers
        include WithPartitionsSearch

        # @param devicegraph [Y2Storage::Devicegraph]
        # @param disk_analyzer [Y2Storage::DiskAnalyzer]
        def initialize(devicegraph, disk_analyzer)
          super()
          @devicegraph = devicegraph
          @disk_analyzer = disk_analyzer
        end

        # Solves the search of the MD RAID configs and solves the searches of their partitions.
        #
        # @note The config object is modified.
        #
        # @param config [Storage::Config]
        # @return [Storage::Config]
        def solve(config)
          config.md_raids = super(config.md_raids, candidate_md_raids)
          solve_partitions_search(config.md_raids)
          config
        end

      private

        # @return [Y2Storage::Devicegraph]
        attr_reader :devicegraph

        # @return [Y2Storage::DiskAnalyzer]
        attr_reader :disk_analyzer

        # @see DevicesSearch#match_condition?
        # @param md_raid_config [Configs::MdRaid]
        # @param md_raid [Y2Storage::Md]
        #
        # @return [Boolean]
        def match_condition?(md_raid_config, md_raid)
          match_name?(md_raid_config, md_raid) && match_size?(md_raid_config, md_raid)
        end

        # Candidate MD RAIDs for solving the search of the configs.
        #
        # @return [Array<Y2Storage::Md]
        def candidate_md_raids
          devicegraph.md_raids.select { |d| disk_analyzer.candidate_device?(d) }
        end
      end
    end
  end
end
