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

require "agama/storage/config_conversions/partition/from_json"
require "y2storage/partition_tables/type"

module Agama
  module Storage
    module ConfigConversions
      module Partitionable
        # Partitionable device conversion from JSON hash according to schema.
        class FromJSON
          # @todo Replace settings and volume_builder params by a ProductDefinition.
          #
          # @param partitionable_json [Hash]
          # @param settings [ProposalSettings]
          # @param volume_builder [VolumeTemplatesBuilder]
          def initialize(partitionable_json, settings:, volume_builder:)
            @partitionable_json = partitionable_json
            @settings = settings
            @volume_builder = volume_builder
          end

          # Performs the conversion from Hash according to the JSON schema.
          #
          # @param config [#ptable_type=, #partitions=]
          def convert(config)
            config.ptable_type = convert_ptable_type
            config.partitions = convert_partitions
            config
          end

        private

          # @return [Hash]
          attr_reader :partitionable_json

          # @return [ProposalSettings]
          attr_reader :settings

          # @return [VolumeTemplatesBuilder]
          attr_reader :volume_builder

          # @return [Y2Storage::PartitionTables::Type, nil]
          def convert_ptable_type
            value = partitionable_json[:ptableType]
            return unless value

            Y2Storage::PartitionTables::Type.find(value)
          end

          # @return [Array<Configs::Partition>]
          def convert_partitions
            partitions_json = partitionable_json[:partitions]
            return [] unless partitions_json

            partitions_json.map { |p| convert_partition(p) }
          end

          # @param partition_json [Hash]
          # @return [Configs::Partition]
          def convert_partition(partition_json)
            Partition::FromJSON.new(partition_json,
              settings: settings, volume_builder: volume_builder).convert
          end
        end
      end
    end
  end
end
