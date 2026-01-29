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

require "agama/storage/config_conversions/to_model_conversions/base"
require "agama/storage/config_conversions/to_model_conversions/logical_volume"

module Agama
  module Storage
    module ConfigConversions
      module ToModelConversions
        # LVM volume group conversion to model according to the JSON schema.
        class VolumeGroup < Base
          include WithFilesystem

          # @param config [Configs::VolumeGroup]
          # @param storage_config [Storage::Config]
          # @param volumes [VolumeTemplatesBuilder]
          def initialize(config, storage_config, volumes)
            super()
            @config = config
            @storage_config = storage_config
            @volumes = volumes
          end

        private

          # @return [Storage::Config]
          attr_reader :storage_config

          # @return [VolumeTemplatesBuilder]
          attr_reader :volumes

          # @see Base#conversions
          def conversions
            {
              vgName:         config.name,
              extentSize:     config.extent_size&.to_i,
              targetDevices:  convert_target_devices,
              logicalVolumes: convert_logical_volumes
            }
          end

          # Name of the target devices.
          #
          # @return [Array<String>]
          def convert_target_devices
            config.physical_volumes_devices
              .map { |a| storage_config.partitionable(a)&.device_name }
              .compact
          end

          # @return [Array<Hash>]
          def convert_logical_volumes
            config.logical_volumes.map do |logical_volume|
              ToModelConversions::LogicalVolume.new(logical_volume, volumes).convert
            end
          end
        end
      end
    end
  end
end
