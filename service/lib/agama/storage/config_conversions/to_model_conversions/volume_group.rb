# frozen_string_literal: true

# Copyright (c) [2025-2026] SUSE LLC
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
require "agama/storage/config_conversions/to_model_conversions/with_space_policy"

module Agama
  module Storage
    module ConfigConversions
      module ToModelConversions
        # LVM volume group conversion to model according to the JSON schema.
        class VolumeGroup < Base
          include WithSpacePolicy

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
              name:                config.device_name,
              vgName:              config.name,
              extentSize:          config.extent_size&.to_i,
              targetDevices:       convert_target_devices,
              targetDevicesPolicy: convert_target_devices_policy,
              spacePolicy:         convert_space_policy,
              logicalVolumes:      convert_logical_volumes
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

          # Policy for creating physical volumes in the target devices.
          #
          # @return ["useNeeded", "useAvailable", nil]
          def convert_target_devices_policy
            {
              use_needed:    "useNeeded",
              use_available: "useAvailable"
            }[config.physical_volumes_policy]
          end

          # @return [Array<Hash>]
          def convert_logical_volumes
            config.logical_volumes
              .reject(&:skipped?)
              .map { |l| ToModelConversions::LogicalVolume.new(l, volumes).convert }
          end
        end
      end
    end
  end
end
