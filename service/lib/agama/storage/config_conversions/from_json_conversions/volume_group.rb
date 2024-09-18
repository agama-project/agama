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
require "agama/storage/config_conversions/from_json_conversions/logical_volume"
require "agama/storage/configs/drive"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Volume group conversion from JSON hash according to schema.
        class VolumeGroup < Base
          # @param volume_group_json [Hash]
          # @param config_builder [ConfigBuilder, nil]
          def initialize(volume_group_json, config_builder: nil)
            super(config_builder)
            @volume_group_json = volume_group_json
          end

          # @see Base#convert
          #
          # @param default [Configs::VolumeGroup, nil]
          # @return [Configs::VolumeGroup]
          def convert(default = nil)
            super(default || Configs::VolumeGroup.new)
          end

        private

          # @return [Hash]
          attr_reader :volume_group_json

          # @see Base#conversions
          #
          # @param _default [Configs::VolumeGroup]
          # @return [Hash]
          def conversions(_default)
            {
              name:             volume_group_json[:name],
              extent_size:      convert_extent_size,
              physical_volumes: volume_group_json[:physicalVolumes],
              logical_volumes:  convert_logical_volumes
            }
          end

          # @return [Y2Storage::DiskSize, nil]
          def convert_extent_size
            value = volume_group_json[:extentSize]
            return unless value

            Y2Storage::DiskSize.new(value)
          end

          # @return [Array<Configs::LogicalVolume>, nil]
          def convert_logical_volumes
            logical_volumes_json = volume_group_json[:logicalVolumes]
            return unless logical_volumes_json

            logical_volumes_json.map { |l| convert_logical_volume(l) }
          end

          # @param logical_volume_json [Hash]
          # @return [Configs::LogicalVolume]
          def convert_logical_volume(logical_volume_json)
            FromJSONConversions::LogicalVolume
              .new(logical_volume_json, config_builder: config_builder)
              .convert
          end
        end
      end
    end
  end
end
