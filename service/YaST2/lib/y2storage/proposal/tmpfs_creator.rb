# Copyright (c) [2020] SUSE LLC
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

require "y2storage/filesystems/tmpfs"
require "y2storage/proposal/creator_result"

module Y2Storage
  module Proposal
    # Class to create a Tmpfs filesystem according to a Planned::Tmpfs object
    class TmpfsCreator
      attr_reader :original_devicegraph

      # Constructor
      #
      # @param original_devicegraph [Devicegraph] Initial devicegraph
      def initialize(original_devicegraph)
        @original_devicegraph = original_devicegraph
      end

      # Creates the Tmpfs filesystem
      #
      # @param planned_tmpfs  [Planned::Tmpfs] planned Tmpfs filesystem
      # @return [CreatorResult] result containing the new Tmpfs filesystem
      def create_tmpfs(planned_tmpfs)
        new_graph = original_devicegraph.duplicate

        tmpfs = Filesystems::Tmpfs.create(new_graph)
        tmpfs.mount_path = planned_tmpfs.mount_point
        tmpfs.mount_point.mount_options = planned_tmpfs.fstab_options

        CreatorResult.new(new_graph, tmpfs.mount_path => planned_tmpfs)
      end
    end
  end
end
