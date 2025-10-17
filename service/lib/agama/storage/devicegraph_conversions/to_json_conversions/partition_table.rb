# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require "agama/storage/devicegraph_conversions/to_json_conversions/interface"

module Agama
  module Storage
    module DevicegraphConversions
      module ToJSONConversions
        # Interface for devices that contain a partition table.
        class PartitionTable < Interface
          def self.apply?(storage_device)
            storage_device.is?(:blk_device) &&
              storage_device.respond_to?(:partition_table?) &&
              storage_device.partition_table?
          end

        private

          def conversions
            {
              type:         partition_table_type,
              unused_slots: partition_table_unused_slots
            }
          end

          # Type of the partition table
          #
          # @return [String]
          def partition_table_type
            storage_device.partition_table.type.to_s
          end

          # Available slots within a partition table, that is, the spaces that can be used to
          # create a new partition.
          #
          # @return [Array<Array(Integer, Integer)>] The first block and the size of each slot.
          def partition_table_unused_slots
            storage_device.partition_table.unused_partition_slots.map do |slot|
              [slot.region.start, slot.region.size.to_i]
            end
          end
        end
      end
    end
  end
end
