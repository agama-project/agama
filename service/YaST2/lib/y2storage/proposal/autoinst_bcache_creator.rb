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
require "y2storage/proposal/autoinst_partitioner"

module Y2Storage
  module Proposal
    # Class to create a bcache device according to a Planned::Bcache object
    # using AutoYaST specifications for the sizes
    class AutoinstBcacheCreator
      include Yast::Logger

      attr_reader :original_devicegraph

      # Constructor
      #
      # @param original_devicegraph [Devicegraph] Initial devicegraph
      def initialize(original_devicegraph)
        @original_devicegraph = original_devicegraph
      end

      # Creates the Bcache device
      #
      # @param planned_bcache  [Planned::Bcache] bcache device
      # @param backing_devname [String] Backing device name
      # @param caching_devname [String, nil] Caching device name
      #
      # @return [CreatorResult] Result containing the new bcache device
      def create_bcache(planned_bcache, backing_devname, caching_devname)
        new_graph = original_devicegraph.duplicate
        bcache =
          if planned_bcache.reuse?
            find_bcache(new_graph, planned_bcache.name)
          else
            create_bcache_device(new_graph, planned_bcache, backing_devname, caching_devname)
          end

        partitioner = AutoinstPartitioner.new(new_graph)
        partitioner.process_device(bcache, planned_bcache)
      end

      private

      # @param devicegraph     [Devicegraph] devicegraph in which the device must be created
      # @param planned_bcache  [Planned::Bcache] Bcache device
      # @param backing_devname [String] Backing device name
      # @param caching_devname [String, nil] Caching device name, or nil if the Bcache device is not
      #   cached
      #
      # @return [Planned::Bcache]
      def create_bcache_device(devicegraph, planned_bcache, backing_devname, caching_devname)
        backing_device = find_blk_device(devicegraph, backing_devname)
        backing_device.remove_descendants

        bcache = backing_device.create_bcache(planned_bcache.name)
        bcache.cache_mode = planned_bcache.cache_mode if planned_bcache.cache_mode

        if caching_devname
          caching_device = find_blk_device(devicegraph, caching_devname)
          bcache_cset = find_or_create_bcache_cset(caching_device)
          bcache.add_bcache_cset(bcache_cset)
        end

        bcache
      end

      # @param devicegraph [Devicegraph] Devicegraph to search for the bcache device
      # @param name        [String] bcache name
      # @return [Y2Storage::Bcache,nil] bcache device; nil if it is not found
      def find_bcache(devicegraph, name)
        devicegraph.bcaches.find { |r| r.name == name }
      end

      # Finds a block device by name
      #
      # @param devicegraph [Devicegraph] Devicegraph
      # @param dev_name    [String] Device name
      #
      # @return [Device]
      def find_blk_device(devicegraph, dev_name)
        device = Y2Storage::BlkDevice.find_by_name(devicegraph, dev_name)
        device.encryption || device
      end

      # Finds or creates the bcache cset for a caching device
      #
      # @param caching_device [Y2Storage::BlkDevice]
      # @return [Y2Storage::BcacheCset]
      def find_or_create_bcache_cset(caching_device)
        return caching_device.in_bcache_cset if caching_device.in_bcache_cset

        caching_device.remove_descendants
        caching_device.create_bcache_cset
      end
    end
  end
end
