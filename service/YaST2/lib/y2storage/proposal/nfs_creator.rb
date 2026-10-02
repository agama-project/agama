# Copyright (c) [2019] SUSE LLC
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

require "y2storage/planned"
require "y2storage/proposal/creator_result"

module Y2Storage
  module Proposal
    # Class to create a NFS filesystem according to a Planned::Nfs object
    class NfsCreator
      attr_reader :original_devicegraph

      # Constructor
      #
      # @param original_devicegraph [Devicegraph] Initial devicegraph
      def initialize(original_devicegraph)
        @original_devicegraph = original_devicegraph
      end

      # Creates the NFS filesystem
      #
      # @param planned_nfs  [Planned::Nfs] planned NFS filesystem
      # @return [CreatorResult] result containing the new NFS filesystem
      def create_nfs(planned_nfs)
        new_graph = original_devicegraph.duplicate

        nfs = Filesystems::Nfs.create(new_graph, planned_nfs.server, planned_nfs.path)
        nfs.mount_path = planned_nfs.mount_point
        nfs.mount_point.mount_options = planned_nfs.fstab_options

        CreatorResult.new(new_graph, nfs.share => planned_nfs)
      end
    end
  end
end
