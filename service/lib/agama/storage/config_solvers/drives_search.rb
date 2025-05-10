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
require "agama/storage/config_solvers/partitions_search"
require "agama/storage/config_solvers/search_conditions"
require "y2storage/disk_analyzer"

module Agama
  module Storage
    module ConfigSolvers
      # Solver for the search of the drive configs.
      class DrivesSearch
        include SearchConditions

        # @param devicegraph [Y2Storage::Devicegraph]
        def initialize(devicegraph)
          @devicegraph = devicegraph
        end

        # Solves the search of the drive configs and solves the searches of their partitions.
        #
        # @note The config object is modified.
        #
        # @param config [Configs]
        def solve(config)
          solver = DevicesSearch.new(candidate_drives)
          config.drives = solver.solve(config.drives) { |d| build_condition(d.search) }
          config.drives.each { |d| solve_partitions_search(d) }
        end

      private

        # @return [Y2Storage::Devicegraph]
        attr_reader :devicegraph

        # Solves the search of the partition configs from the given drive config.
        #
        # @note The drive config object is modified.
        #
        # @param drive_config [Configs::Drive]
        def solve_partitions_search(drive_config)
          ConfigSolvers::PartitionsSearch.new(devicegraph).solve(drive_config)
        end

        # Candidate drives for solving the search of drive configs.
        #
        # @return [Array<Y2Storage::Drive, Y2Storage::StrayBlkDevice>]
        def candidate_drives
          disk_analyzer = Y2Storage::DiskAnalyzer.new(devicegraph)
          candidate_sids = disk_analyzer.candidate_disks.map(&:sid)

          drives = devicegraph.disk_devices + devicegraph.stray_blk_devices
          drives.select { |d| candidate_sids.include?(d.sid) }
        end

        # Builds the search condition.
        #
        # @param search [Configs::Search]
        # @return [Proc] Accepts a candidate device and returns whether the device matches.
        def build_condition(search)
          name_condition = name_condition(search)
          size_condition = size_condition(search)

          proc { |d| name_condition.call(d) && size_condition.call(d) }
        end
      end
    end
  end
end
