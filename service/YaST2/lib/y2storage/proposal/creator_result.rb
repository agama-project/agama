# Copyright (c) [2017] SUSE LLC
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

module Y2Storage
  module Proposal
    # Result of executing one of the devices creators. See
    # {Proposal::PartitionCreator}, {Proposal::LvmCreator}, {Proposal::AutoinstMdCreator},
    # {Proposal::AutoinstBcacheCreator} and {Proposal::BtrfsCreator}.
    #
    # FIXME: this class wouldn't be needed if each planned device would contain
    # an attribute with the name of the created device. That would also mean a
    # nicer API for some methods that currently receive the created device as
    # argument, like Planned::Md.add_devices or Planned::CanBeFormatted#format!.
    # That would imply that the creators would modify the list of planned
    # devices received as argument enriching them with more information.
    class CreatorResult
      # @return [Devicegraph] Devicegraph containing the new devices
      attr_reader :devicegraph

      # @return [Hash{String => Planned::Device}] Planned devices indexed by
      #   the name of the final device where they were placed.
      attr_reader :devices_map

      def initialize(devicegraph, devices_map)
        @devicegraph = devicegraph
        @devices_map = devices_map
      end

      # Names of the devices that were created to materialize every planned
      # device.
      #
      # If a block is given, it's used to filter by planned device.
      #
      # @return [Array<String>]
      def created_names
        if block_given?
          devices_map.select { |_k, v| yield(v) }.keys
        else
          devices_map.keys
        end
      end

      # @see #merge
      #
      # @note This modifies the object in which is called
      def merge!(other)
        @devicegraph = other.devicegraph
        @devices_map.merge!(other.devices_map)
      end

      # Combines two results. The new result will contain the devicegraph of the
      # most recent result and both devices maps.
      #
      # @param other [CreatorResult] the most recent result
      def merge(other)
        CreatorResult.new(other.devicegraph, devices_map.merge(other.devices_map))
      end
    end
  end
end
