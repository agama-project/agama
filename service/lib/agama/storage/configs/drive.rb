# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require "agama/storage/configs/search"

module Agama
  module Storage
    module Configs
      # Section of the configuration representing a device that is expected to exist in the target
      # system and that can be used as a regular disk.
      class Drive
        # @return [Search, nil]
        attr_accessor :search

        # @return [Encryption, nil]
        attr_accessor :encryption

        # @return [Filesystem, nil]
        attr_accessor :filesystem

        # @return [Y2Storage::PartitionTables::Type, nil]
        attr_accessor :ptable_type

        # @return [Array<Partition>]
        attr_accessor :partitions

        # Constructor
        def initialize
          @partitions = []
        end

        # Resolves the search, so a devices of the given devicegraph is associated to the drive if
        # possible
        #
        # Since all drives are expected to match a real device in the system, this creates a default
        # search if that was ommited.
        #
        # @param devicegraph [Y2Storage::Devicegraph] source of the search
        # @param used_sids [Array<Integer>] SIDs of the devices that are already associated to
        #   another drive, so they cannot be associated to this
        def search_device(devicegraph, used_sids)
          @search ||= default_search
          devs = devicegraph.blk_devices.select { |d| d.is?(:disk_device, :stray_blk_device) }
          search.find(devs, used_sids)
        end

        # @return [Search]
        def default_search
          Search.new
        end

        # Device resulting from a previous call to {#search_device}
        #
        # @return [Y2Storage::Device, nil]
        def found_device
          search&.device
        end

        # Whether the drive definition contains partition definitions
        #
        # @return [Boolean]
        def partitions?
          partitions.any?
        end
      end
    end
  end
end
