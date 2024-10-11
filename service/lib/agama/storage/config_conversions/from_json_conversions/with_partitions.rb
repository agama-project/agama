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

require "agama/storage/config_conversions/from_json_conversions/partition"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Mixin for partitions conversion.
        module WithPartitions
          # @return [Array<Configs::Partition>, nil]
          def convert_partitions
            partitions_json = config_json[:partitions]
            return unless partitions_json

            partitions_json.map { |p| convert_partition(p) }
          end

          # @param partition_json [Hash]
          # @return [Configs::Partition]
          def convert_partition(partition_json)
            FromJSONConversions::Partition.new(partition_json).convert
          end
        end
      end
    end
  end
end
