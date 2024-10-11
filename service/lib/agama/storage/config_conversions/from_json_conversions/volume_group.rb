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
require "agama/storage/config_conversions/from_json_conversions/encryption"
require "agama/storage/config_conversions/from_json_conversions/logical_volume"
require "agama/storage/configs/volume_group"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Volume group conversion from JSON hash according to schema.
        class VolumeGroup < Base
          # @see Base#convert
          # @return [Configs::VolumeGroup]
          def convert
            super(Configs::VolumeGroup.new)
          end

        private

          alias_method :volume_group_json, :config_json

          # @see Base#conversions
          # @return [Hash]
          def conversions
            {
              name:                        volume_group_json[:name],
              extent_size:                 convert_extent_size,
              physical_volumes_devices:    convert_physical_volumes_devices,
              physical_volumes_encryption: convert_physical_volumes_encryption,
              physical_volumes:            convert_physical_volumes,
              logical_volumes:             convert_logical_volumes
            }
          end

          # @return [Y2Storage::DiskSize, nil]
          def convert_extent_size
            value = volume_group_json[:extentSize]
            return unless value

            Y2Storage::DiskSize.new(value)
          end

          # @return [Array<String>, nil]
          def convert_physical_volumes_devices
            generate_json = physical_volume_generate_json&.fetch(:generate)
            return unless generate_json

            generate_json.is_a?(Array) ? generate_json : generate_json[:targetDevices]
          end

          # @return [Configs::Encryption, nil]
          def convert_physical_volumes_encryption
            generate_json = physical_volume_generate_json&.fetch(:generate)
            return unless generate_json.is_a?(Hash)

            encryption_json = generate_json[:encryption]
            return unless encryption_json

            FromJSONConversions::Encryption.new(encryption_json).convert
          end

          # JSON of the physical volume with a 'generate'.
          #
          # @return [Hash, nil]
          def physical_volume_generate_json
            physical_volumes_json = volume_group_json[:physicalVolumes]
            return unless physical_volumes_json

            physical_volumes_json.find { |p| p.is_a?(Hash) }
          end

          # @return [Array<String>, nil]
          def convert_physical_volumes
            physical_volumes_json = volume_group_json[:physicalVolumes]
            return unless physical_volumes_json

            physical_volumes_json.select { |c| c.is_a?(String) }
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
            FromJSONConversions::LogicalVolume.new(logical_volume_json).convert
          end
        end
      end
    end
  end
end
