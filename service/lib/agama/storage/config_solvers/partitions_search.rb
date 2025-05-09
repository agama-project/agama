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
require "agama/storage/config_solvers/search_conditions"

module Agama
  module Storage
    module ConfigSolvers
      # Solver for the search of the partition configs.
      class PartitionsSearch
        include SearchConditions

        # @param devicegraph [Y2Storage::Devicegraph]
        def initialize(devicegraph)
          @devicegraph = devicegraph
        end

        # Solves the search of the partition configs.
        #
        # @note The config object is modified.
        #
        # @param config [#partitions, #found_device]
        def solve(config)
          partitions = config.found_device&.partitions || []
          solver = DevicesSearch.new(partitions)
          config.partitions = solver.solve(config.partitions) { |p| build_condition(p.search) }
        end

      private

        # @return [Y2Storage::Devicegraph]
        attr_reader :devicegraph

        # Builds the search condition.
        #
        # @param search [Configs::Search]
        # @return [Proc] Accepts a partition and returns whether the partition matches.
        def build_condition(search)
          return proc { true } unless search

          name_condition = name_condition(search)
          size_condition = size_condition(search)

          proc { |p| name_condition.call(p) && size_condition.call(p) }
        end
      end
    end
  end
end
