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

require "agama/storage/config_conversions/block_device/from_json"
require "agama/storage/config_conversions/size/from_json"
require "agama/storage/configs/partition"
require "y2storage/partition_id"

module Agama
  module Storage
    module ConfigConversions
      module Partition
        # Partition conversion from JSON hash according to schema.
        class FromJSON
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
          # @return [Configs::Partition]
          def convert
            Configs::Partition.new.tap do |config|
              config.id = convert_id
              config.size = convert_size
              convert_block_device(config)
            end
          end

        private

          # @return [Hash]
          attr_reader :partition_json

          # @return [ProposalSettings]
          attr_reader :settings

          # @return [VolumeTemplatesBuilder]
          attr_reader :volume_builder

          # @return [Y2Storage::PartitionId, nil]
          def convert_id
            # @todo Decide whether to use "create" in JSON schema.
            value = partition_json.dig(:create, :id)
            return unless value

            Y2Storage::PartitionId.find(value)
          end

          # @return [Configs::Size]
          def convert_size
            # @todo Decide whether to use "create" in JSON schema.
            size_json = partition_json.dig(:create, :size)
            return default_size_config unless size_json

            Size::FromJSON.new(size_json).convert
          end

          # @param config [Configs::Partition]
          def convert_block_device(config)
            converter = BlkDevice::FromJSON.new(partition_json,
              settings: settings, volume_builder: volume_builder)

            converter.convert(config)
          end

          # @todo Auto size?
          #
          # @return [Configs::Size]
          def default_size_config
            mount_path = partition_json.dig(:mount, :path)
            volume = volume_builder.for(mount_path || "")

            Configs::Size.new.tap do |config|
              config.min = volume.min_size
              config.max = volume.max_size
            end
          end
        end
      end
    end
  end
end
