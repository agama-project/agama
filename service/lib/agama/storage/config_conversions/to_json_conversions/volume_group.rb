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

require "agama/storage/config_conversions/to_json_conversions/base"
require "agama/storage/config_conversions/to_json_conversions/encryption"
require "agama/storage/config_conversions/to_json_conversions/logical_volume"
require "agama/storage/configs/volume_group"

module Agama
  module Storage
    module ConfigConversions
      module ToJSONConversions
        # Volume group conversion to JSON hash according to schema.
        class VolumeGroup < Base
          # @see Base
          def self.config_type
            Configs::VolumeGroup
          end

        private

          # @see Base#conversions
          def conversions
            {
              name:            config.name,
              extentSize:      config.extent_size&.to_i,
              physicalVolumes: convert_physical_volumes,
              logicalVolumes:  convert_logical_volumes
            }
          end

          # @return [Integer, nil]
          def convert_extent_size
            extent_size = config.extent_size
            return unless extent_size

            extent_size.to_i
          end

          # @return [Array<String, Hash>]
          def convert_physical_volumes
            [
              config.physical_volumes,
              convert_physical_volumes_devices
            ].flatten.compact
          end

          # @return [Hash, nil]
          def convert_physical_volumes_devices
            devices = config.physical_volumes_devices
            return if devices.empty?

            encryption = config.physical_volumes_encryption
            return { generate: devices } unless encryption

            {
              generate: {
                targetDevices: devices,
                encryption:    ToJSONConversions::Encryption.new(encryption).convert
              }
            }
          end

          # @return [Array<Hash>]
          def convert_logical_volumes
            config.logical_volumes
              .map { |l| ToJSONConversions::LogicalVolume.new(l).convert }
              .compact
          end
        end
      end
    end
  end
end
