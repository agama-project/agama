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
require "y2storage/disk_analyzer"

module Agama
  module Storage
    module ConfigSolvers
      # Solver for the search of the drive configs.
      class DrivesSearch < DevicesSearch
        include SearchMatchers
        include WithPartitionsSearch

        # @param devicegraph [Y2Storage::Devicegraph]
        def initialize(devicegraph)
          super()
          @devicegraph = devicegraph
        end

        # Solves the search of the drive configs and solves the searches of their partitions.
        #
        # @note The config object is modified.
        #
        # @param config [Storage::Config]
        # @return [Storage::Config]
        def solve(config)
          config.drives = super(config.drives, candidate_drives)
          solve_partitions_search(config.drives)
          config
        end

      private

        # @return [Y2Storage::Devicegraph]
        attr_reader :devicegraph

        # @see DevicesSearch#match_condition?
        # @param drive_config [Configs::Drive]
        # @param drive [Y2Storage::Disk, Y2Storage::StrayBlkDevice]
        #
        # @return [Boolean]
        def match_condition?(drive_config, drive)
          match_name?(drive_config, drive) && match_size?(drive_config, drive)
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
      end
    end
  end
end
