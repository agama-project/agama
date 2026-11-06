# Copyright (c) [2023] SUSE LLC
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

require "y2storage/proposal/space_maker_actions/base"
require "y2storage/proposal/partition_killer"

module Y2Storage
  module Proposal
    module SpaceMakerActions
      # Action for deleting a given partition
      #
      # @see Base
      class Delete < Base
        # @return [Boolean] see {PartitionKiller#delete_by_sid}
        attr_reader :related_partitions

        # Constructor
        def initialize(device, related_partitions: true)
          super(device)
          @related_partitions = related_partitions
        end

        # @param devicegraph [Devicegraph]
        # @param disk_names [Array<String>] collateral actions are restricted to these disks
        def delete(devicegraph, disk_names)
          killer = PartitionKiller.new(devicegraph, disk_names)
          killer.delete_by_sid(sid, delete_related_partitions: related_partitions)
        end
      end
    end
  end
end
