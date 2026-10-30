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

module Y2Storage
  module Proposal
    module SpaceMakerActions
      # Action for clearing up the content of a block device
      #
      # @see Base
      class Wipe < Base
        # @param devicegraph [Devicegraph]
        def wipe(devicegraph)
          disk = devicegraph.find_device(sid)
          remove_content(disk)
          []
        end

        private

        # Remove descendants of a disk and also partitions from other disks that
        # are not longer useful afterwards
        #
        # TODO: delete partitions that were part of the removed VG and/or RAID
        #
        # @param disk [Partitionable] disk-like device to cleanup. It must not be
        #   part of a multipath device or a BIOS RAID.
        def remove_content(disk)
          disk.remove_descendants
        end
      end
    end
  end
end
