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
require "agama/storage/config_conversions/partitionable/from_json"
require "agama/storage/configs/drive"

module Agama
  module Storage
    module ConfigConversions
      module Drive
        # Drive conversion from JSON hash according to schema.
        class FromJSON
          # @todo Replace settings and volume_builder params by a ProductDefinition.
          #
          # @param drive_json [Hash]
          # @param settings [ProposalSettings]
          # @param volume_builder [VolumeTemplatesBuilder]
          def initialize(drive_json, settings:, volume_builder:)
            @drive_json = drive_json
            @settings = settings
            @volume_builder = volume_builder
          end

          # Performs the conversion from Hash according to the JSON schema.
          #
          # @return [Configs::Drive]
          def convert
            Configs::Drive.new.tap do |config|
              convert_block_device(config)
              convert_partitionable(config)
            end
          end

        private

          # @return [Hash]
          attr_reader :drive_json

          # @return [ProposalSettings]
          attr_reader :settings

          # @return [VolumeTemplatesBuilder]
          attr_reader :volume_builder

          # @param config [Configs::Drive]
          def convert_block_device(config)
            converter = BlockDevice::FromJSON.new(drive_json,
              settings: settings, volume_builder: volume_builder)

            converter.convert(config)
          end

          # @param config [Configs::Drive]
          def convert_partitionable(config)
            converter = Partitionable::FromJSON.new(drive_json,
              settings: settings, volume_builder: volume_builder)

            converter.convert(config)
          end
        end
      end
    end
  end
end
