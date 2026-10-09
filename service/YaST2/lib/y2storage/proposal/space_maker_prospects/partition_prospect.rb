# Copyright (c) [2018] SUSE LLC
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

require "y2storage/proposal/space_maker_prospects/base"

module Y2Storage
  module Proposal
    module SpaceMakerProspects
      # Abstract class to represent a prospect action on a partition.
      #
      # @see Base
      class PartitionProspect < Base
        # @return [Integer] number of the first sector of the partition
        attr_reader :region_start

        # @param partition [Partition] partition to act upon
        # @param disk_analyzer [DiskAnalyzer] see {#analyzer}
        def initialize(partition, disk_analyzer)
          super(partition)
          @disk_name = partition.partitionable.name
          @region_start = partition.region.start
          @analyzer = disk_analyzer
        end

        # Whether there was a Linux partition in the same disk of the target
        # partition (in the original devicegraph).
        #
        # @return [Boolean]
        def linux_in_disk?
          return @linux_in_disk unless @linux_in_disk.nil?

          @linux_in_disk = analyzer.linux_partitions(disk_name).any?
        end

        # Whether there was a Windows system in the same disk of the target
        # partition (in the original devicegraph).
        #
        # @return [Boolean]
        def windows_in_disk?
          return @windows_in_disk unless @windows_in_disk.nil?

          @windows_in_disk = analyzer.windows_partitions(disk_name).any?
        end

        private

        # @return [DiskAnalyzer] disk analyzer with information about the
        # initial layout of the system
        attr_reader :analyzer

        # @return [String] kernel name of the device hosting the partition
        attr_reader :disk_name
      end
    end
  end
end
