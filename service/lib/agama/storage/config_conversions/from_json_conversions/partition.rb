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

require "agama/storage/config_conversions/from_json_conversions/base"
require "agama/storage/config_conversions/from_json_conversions/with_encryption"
require "agama/storage/config_conversions/from_json_conversions/with_filesystem"
require "agama/storage/config_conversions/from_json_conversions/with_search"
require "agama/storage/config_conversions/from_json_conversions/with_size"
require "agama/storage/configs/partition"
require "y2storage/partition_id"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Partition conversion from JSON hash according to schema.
        class Partition < Base
          include WithSearch
          include WithEncryption
          include WithFilesystem
          include WithSize

          # @param partition_json [Hash]
          def initialize(partition_json, config_builder: nil)
            super(config_builder)
            @partition_json = partition_json
          end

          # @see Base#convert
          #
          # @param default [Configs::Partition, nil]
          # @return [Configs::Partition]
          def convert(default = nil)
            super(default || Configs::Partition.new)
          end

        private

          # @return [Hash]
          attr_reader :partition_json

          # @see Base#conversions
          #
          # @param default [Configs::Partition]
          # @return [Hash]
          def conversions(default)
            {
              search:           convert_search(partition_json, default: default.search),
              encryption:       convert_encryption(partition_json, default: default.encryption),
              filesystem:       convert_filesystem(partition_json, default: default.filesystem),
              size:             convert_size(partition_json, default: default.size),
              id:               convert_id,
              delete:           partition_json[:delete],
              delete_if_needed: partition_json[:deleteIfNeeded]
            }
          end

          # @return [Y2Storage::PartitionId, nil]
          def convert_id
            value = partition_json[:id]
            return unless value

            Y2Storage::PartitionId.find(value)
          end
        end
      end
    end
  end
end
