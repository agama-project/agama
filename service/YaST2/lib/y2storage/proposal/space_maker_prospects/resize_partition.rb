# Copyright (c) [2018-2023] SUSE LLC
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

require "y2storage/proposal/space_maker_prospects/partition_prospect"

module Y2Storage
  module Proposal
    module SpaceMakerProspects
      # Represents the prospect action of resizing a given (Windows) partition
      #
      # @see Base
      class ResizePartition < PartitionProspect
        # @param partition [Partition] partition to resize
        # @param disk_analyzer [DiskAnalyzer] see {#analyzer}
        def initialize(partition, disk_analyzer)
          super
          @partition = partition
        end

        # Size of the space that could be theoretically reclaimed by shrinking
        # the partition.
        #
        # Since calculating this value implies mounting the filesystem, the
        # value is only calculated on the first call to the method and cached
        # for subsequent calls.
        #
        # @see BlkDevice#recoverable_size
        #
        # @return [DiskSize]
        def recoverable_size
          @recoverable_size ||= @partition.recoverable_size
        end

        # Whether performing the action would be acceptable
        #
        # @param settings [ProposalSettings]
        def allowed?(settings)
          settings.resize_windows
        end

        protected

        # @see #action
        def action_class
          SpaceMakerActions::Shrink
        end
      end
    end
  end
end
