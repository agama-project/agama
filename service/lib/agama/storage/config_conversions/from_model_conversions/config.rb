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

require "agama/storage/config_conversions/from_model_conversions/base"
require "agama/storage/config_conversions/from_model_conversions/boot"
require "agama/storage/config_conversions/from_model_conversions/drive"
require "agama/storage/config"

module Agama
  module Storage
    module ConfigConversions
      module FromModelConversions
        # Config conversion from model according to the JSON schema.
        class Config < Base
        private

          # @see Base
          # @return [Storage::Config]
          def default_config
            Storage::Config.new
          end

          # @see Base#conversions
          # The conversion of boot and drives is special because the relationship between them.
          #
          # A boot model can indicates a boot device name. If so, the following steps are needed:
          # * Add a drive model for the boot device if there is no drive model for it, see
          #   {#convert_drives}.
          # * Add an alias to the drive config of the boot device if it has no alias, and set that
          #   alias to the boot device config, see #{convert_boot_device_alias}.
          #
          # @return [Hash]
          def conversions
            boot_config = convert_boot
            drive_configs = convert_drives
            drive_config = boot_drive_config(drive_configs)

            convert_boot_device_alias(boot_config, drive_config)

            {
              boot:   boot_config,
              drives: drive_configs
            }
          end

          # @return [Configs::Boot, nil]
          def convert_boot
            boot_model = model_json[:boot]
            return unless boot_model

            FromModelConversions::Boot.new(boot_model).convert
          end

          # @return [Array<Configs::Drive>, nil]
          def convert_drives
            return unless drive_models

            drive_models.map { |d| convert_drive(d) }
          end

          # @param drive_model [Hash]
          # @return [Configs::Drive]
          def convert_drive(drive_model)
            FromModelConversions::Drive.new(drive_model).convert
          end

          # Conversion for the boot device alias.
          #
          # It requieres both boot and drives already converted.
          #
          # @param boot_config [Configs::Boot, nil] The boot config can be modified.
          # @param drive_config [Configs::Drive, nil] The drive config can be modifed.
          def convert_boot_device_alias(boot_config, drive_config)
            return unless boot_config && drive_config
            return unless boot_config.configure? && !boot_config.device.default?

            drive_config.ensure_alias
            boot_config.device.device_alias = drive_config.alias
          end

          # Drive config for the boot device, if any.
          #
          # @param drive_configs [Array<Configs::Drive>, nil]
          # @return [Configs::Drive, nil]
          def boot_drive_config(drive_configs)
            return unless drive_configs && boot_device_name

            drive_configs.find { |d| d.search.name == boot_device_name }
          end

          # Drive models to convert to drive configs.
          #
          # It includes all the drives from the drive section of the model, adding a drive for the
          # selected boot device if needed. See {#calculate_drive_models}.
          #
          # @return [Array<Hash>, nil]
          def drive_models
            return @drive_models if @calculated_drive_models

            @drive_models = calculate_drive_models
          end

          # @return [Array<Hash>, nil]
          def calculate_drive_models
            @calculated_drive_models = true

            models = model_json[:drives]
            return if models.nil? && !missing_boot_drive?

            models ||= []
            models << { name: boot_device_name } if missing_boot_drive?
            models
          end

          # Whether a drive model for the boot device is missing in the list of drives. See
          # {#calculate_missing_boot_device}.
          #
          # @return [Boolean]
          def missing_boot_drive?
            return @missing_boot_drive if @calculated_missing_boot_drive

            @missing_boot_drive ||= calculate_missing_boot_drive
          end

          # @return [Boolean]
          def calculate_missing_boot_drive
            @calculated_missing_boot_drive = true

            configure_boot = model_json.dig(:boot, :configure)
            default_boot = model_json.dig(:boot, :device, :default)

            return false unless configure_boot && !default_boot && !boot_device_name.nil?

            drive_models = model_json[:drives] || []
            drive_models.none? { |d| d[:name] == boot_device_name }
          end

          # Name of the device selected for booting, if any.
          #
          # @return [String, nil]
          def boot_device_name
            @boot_device_name ||= model_json.dig(:boot, :device, :name)
          end
        end
      end
    end
  end
end
