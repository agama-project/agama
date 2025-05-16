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

require "agama/storage/config_solvers/partitions_search"

module Agama
  module Storage
    module ConfigSolvers
      # Mixin for solving the search of the partitions.
      module WithPartitionsSearch
        # Solves the search of the partition configs from the given configs.
        #
        # @param configs [Array<#partitions>]
        def solve_partitions_search(configs)
          configs.each { |c| ConfigSolvers::PartitionsSearch.new.solve(c) }
        end
      end
    end
  end
end
