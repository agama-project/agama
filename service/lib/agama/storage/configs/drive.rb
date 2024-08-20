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
      # Drive configuration.
      class Drive
        # @return [Search]
        attr_accessor :search

        # @return [Encryption]
        attr_accessor :encryption

        # @return [Filesystem]
        attr_accessor :filesystem

        # @return [Y2Storage::PartitionTables::Type]
        attr_accessor :ptable_type

        # @return [Array<Partition>]
        attr_accessor :partitions

        def initialize
          @partitions = []
        end

        def search_device(devicegraph, used_sids)
          @search ||= default_search
          devs = devicegraph.blk_devices.select { |d| d.is?(:disk_device, :stray_blk_device) }
          search.find(self, devs, used_sids)
        end

        def default_search
          Search.new
        end

        def found_device
          search&.device
        end

        def partitions?
          partitions.any?
        end
      end
    end
  end
end
