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

require "agama/storage/config_conversions/from_model_conversions/base"
require "agama/storage/config_conversions/from_model_conversions/encryption"
require "agama/storage/config_conversions/from_model_conversions/with_search"
require "agama/storage/config_conversions/from_model_conversions/with_volumes"
require "agama/storage/configs/volume_group"
require "y2storage/disk_size"

module Agama
  module Storage
    module ConfigConversions
      module FromModelConversions
        # Volume group conversion from model according to the JSON schema.
        class VolumeGroup < Base
          include WithSearch
          include WithVolumes

          # @param model_json [Hash]
          # @param product_config [Agama::Config]
          # @param bootloader_config [Storage::BootloaderConfig]
          # @param targets [Array<Configs::Drive, Configs::MdRaid>]
          # @param encryption_model [Hash, nil]
          def initialize(
            model_json, product_config, bootloader_config, targets, encryption_model = nil
          )
            super(model_json)
            @product_config = product_config
            @bootloader_config = bootloader_config
            @targets = targets
            @encryption_model = encryption_model
          end

        private

          alias_method :volume_group_model, :model_json

          # @return [Agama::Config]
          attr_reader :product_config

          # @return [Storage::BootloaderConfig]
          attr_reader :bootloader_config

          # @return [Array<Configs::Drive, Configs::MdRaid>]
          attr_reader :targets

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
              name:                        volume_group_model[:vgName],
              search:                      convert_search,
              extent_size:                 convert_extent_size,
              physical_volumes_devices:    convert_physical_volumes_devices,
              physical_volumes_policy:     convert_physical_volumes_policy,
              physical_volumes_encryption: convert_physical_volumes_encryption,
              logical_volumes:             convert_volumes
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
              .map { |n| target(n)&.ensure_alias }
              .compact
          end

          # @return [:use_needed, :use_available]
          def convert_physical_volumes_policy
            value = volume_group_model[:targetDevicesPolicy]

            {
              "useNeeded"    => :use_needed,
              "useAvailable" => :use_available
            }[value] || :use_available
          end

          # @return [Configs::Encryption, nil]
          def convert_physical_volumes_encryption
            return unless encryption_model

            FromModelConversions::Encryption.new(encryption_model, bootloader_config).convert
          end

          # @param name [String]
          # @return [Configs::Drive, Configs::MdRaid, nil]
          def target(name)
            targets.find { |d| d.device_name == name }
          end
        end
      end
    end
  end
end
