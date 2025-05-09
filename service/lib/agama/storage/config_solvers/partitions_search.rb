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

module Agama
  module Storage
    module ConfigSolvers
      # Solver for the search of the partition configs.
      class PartitionsSearch < DevicesSearch
        include SearchMatchers

        # Solves the search of the partition configs.
        #
        # @note The config object is modified.
        #
        # @param config [#partitions]
        # @return [#partitions]
        def solve(config)
          candidate_partitions = config.found_device&.partitions || []
          config.partitions = super(config.partitions, candidate_partitions)
          config
        end

      private

        # @see DevicesSearch#match_condition?
        # @param partition_config [Configs::Partition]
        # @param partition [Y2Storage::Partition]
        #
        # @return [Boolean]
        def match_condition?(partition_config, partition)
          match_name?(partition_config, partition) && match_size?(partition_config, partition)
        end
      end
    end
  end
end
