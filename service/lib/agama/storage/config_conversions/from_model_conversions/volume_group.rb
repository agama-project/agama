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

require "agama/storage/config_conversions/from_model_conversions/base"
require "agama/storage/config_conversions/from_model_conversions/logical_volume"
require "agama/storage/config_conversions/from_model_conversions/encryption"
require "agama/storage/configs/volume_group"
require "y2storage/disk_size"

module Agama
  module Storage
    module ConfigConversions
      module FromModelConversions
        # Volume group conversion from model according to the JSON schema.
        class VolumeGroup < Base
          # @param model_json [Hash]
          # @param drives [Array<Configs::Drive>]
          # @param encryption_model [Hash, nil]
          def initialize(model_json, drives, encryption_model = nil)
            super(model_json)
            @drives = drives
            @encryption_model = encryption_model
          end

        private

          alias_method :volume_group_model, :model_json

          # @return [Array<Configs::Drive>]
          attr_reader :drives

          # @return [Hash, nil]
          attr_reader :encryption_model

          # @see Base
          # @return [Configs::VolumeGroup]
          def default_config
            Configs::VolumeGroup.new
          end

          # @see Base#conversions
          # @return [Hash]
          def conversions
            {
              name:                        volume_group_model[:name],
              extent_size:                 convert_extent_size,
              physical_volumes_devices:    convert_physical_volumes_devices,
              physical_volumes_encryption: convert_physical_volumes_encryption,
              logical_volumes:             convert_logical_volumes
            }
          end

          # @return [Y2Storage::DiskSize, nil]
          def convert_extent_size
            value = volume_group_model[:extentSize]
            return unless value

            Y2Storage::DiskSize.new(value)
          end

          # @return [Array<String>, nil]
          def convert_physical_volumes_devices
            target_names = volume_group_model[:targetDevices]
            return unless target_names

            target_names
              .map { |n| drive(n)&.ensure_alias }
              .compact
          end

          # @return [Configs::Encryption, nil]
          def convert_physical_volumes_encryption
            return unless encryption_model

            FromModelConversions::Encryption.new(encryption_model).convert
          end

          # @return [Array<Configs::LogicalVolume>, nil]
          def convert_logical_volumes
            logical_volumes_model = volume_group_model[:logicalVolumes]
            return unless logical_volumes_model

            logical_volumes_model.map { |l| FromModelConversions::LogicalVolume.new(l).convert }
          end

          # @param name [String]
          # @return [Configs::Drive, nil]
          def drive(name)
            drives.find { |d| d.device_name == name }
          end
        end
      end
    end
  end
end
