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

require "agama/storage/config_conversions/from_json_conversions/block_device"
require "agama/storage/config_conversions/from_json_conversions/search"
require "agama/storage/config_conversions/from_json_conversions/size"
require "agama/storage/configs/partition"
require "y2storage/partition_id"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Partition conversion from JSON hash according to schema.
        class Partition
          # @todo Replace settings and volume_builder params by a ProductDefinition.
          #
          # @param partition_json [Hash]
          # @param settings [ProposalSettings]
          # @param volume_builder [VolumeTemplatesBuilder]
          def initialize(partition_json, settings:, volume_builder:)
            @partition_json = partition_json
            @settings = settings
            @volume_builder = volume_builder
          end

          # Performs the conversion from Hash according to the JSON schema.
          #
          # @param default [Configs::Partition, nil]
          # @return [Configs::Partition]
          def convert(default = nil)
            default_config = default.dup || Configs::Partition.new

            convert_block_device(default_config).tap do |config|
              search = convert_search(config.search)
              delete = partition_json[:delete]
              delete_if_needed = partition_json[:deleteIfNeeded]
              id = convert_id
              size = convert_size(config.size)

              config.search = search if search
              config.delete = delete unless delete.nil?
              config.delete_if_needed = delete_if_needed unless delete_if_needed.nil?
              config.id = id if id
              config.size = size if size
            end
          end

        private

          # @return [Hash]
          attr_reader :partition_json

          # @return [ProposalSettings]
          attr_reader :settings

          # @return [VolumeTemplatesBuilder]
          attr_reader :volume_builder

          # @param config [Configs::Partition]
          # @return [Configs::Partition]
          def convert_block_device(config)
            converter = FromJSONConversions::BlockDevice.new(partition_json,
              settings: settings, volume_builder: volume_builder)

            converter.convert(config)
          end

          # @param config [Configs::Search]
          # @return [Configs::Search, nil]
          def convert_search(config)
            search_json = partition_json[:search]
            return unless search_json

            converter = FromJSONConversions::Search.new(search_json)
            converter.convert(config)
          end

          # @return [Y2Storage::PartitionId, nil]
          def convert_id
            value = partition_json[:id]
            return unless value

            Y2Storage::PartitionId.find(value)
          end

          # @param config [Configs::Size]
          # @return [Configs::Size, nil]
          def convert_size(config)
            size_json = partition_json[:size]
            return unless size_json

            FromJSONConversions::Size.new(size_json).convert(config)
          end
        end
      end
    end
  end
end
