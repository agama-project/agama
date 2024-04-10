# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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

require "agama/dbus/hash_validator"
require "agama/dbus/types"
require "agama/storage/volume"
require "agama/storage/volume_location"
require "agama/storage/volume_templates_builder"
require "y2storage/disk_size"
require "y2storage/filesystems/type"

module Agama
  module DBus
    module Storage
      module VolumeConversion
        # Volume conversion from D-Bus format.
        class FromDBus
          # @param dbus_volume [Hash]
          # @param config [Agama::Config]
          # @param logger [Logger, nil]
          def initialize(dbus_volume, config:, logger: nil)
            @dbus_volume = dbus_volume
            @config = config
            @logger = logger || Logger.new($stdout)
          end

          # Performs the conversion from D-Bus format.
          #
          # @return [Agama::Storage::Volume]
          def convert
            logger.info("D-Bus volume: #{dbus_volume}")

            dbus_volume_issues.each { |i| logger.warn(i) }

            builder = Agama::Storage::VolumeTemplatesBuilder.new_from_config(config)
            ret = builder.for(dbus_volume["MountPath"] || "").tap do |target|
              valid_dbus_properties.each { |p| conversion(target, p) }
            end

            # The `undefined` value is used as a value for unlimited size in the
            # UI but D-Bus cannot send `undefined`, `nil` or `NULL` values. In
            # that case the value is missing in the D-Bus data. Override the
            # default from the config when the max size is missing.
            if ret.max_size && !ret.max_size.unlimited? && !dbus_volume.key?("MaxSize")
              ret.max_size = Y2Storage::DiskSize.unlimited
            end

            ret
          end

        private

          # @return [Hash]
          attr_reader :dbus_volume

          # @return [Agama::Config]
          attr_reader :config

          # @return [Logger]
          attr_reader :logger

          DBUS_PROPERTIES = [
            {
              name:       "MountPath",
              type:       String,
              conversion: :mount_path_conversion
            },
            {
              name:       "MountOptions",
              type:       Types::Array.new(String),
              conversion: :mount_options_conversion
            },
            {
              name:       "Target",
              type:       String,
              conversion: :target_conversion
            },
            {
              name:       "TargetDevice",
              type:       String,
              conversion: :target_device_conversion
            },
            {
              name:       "FsType",
              type:       String,
              conversion: :fs_type_conversion
            },
            {
              name:       "MinSize",
              type:       Integer,
              conversion: :min_size_conversion
            },
            {
              name:       "MaxSize",
              type:       Integer,
              conversion: :max_size_conversion
            },
            {
              name:       "AutoSize",
              type:       Types::BOOL,
              conversion: :auto_size_conversion
            },
            {
              name:       "Snapshots",
              type:       Types::BOOL,
              conversion: :snapshots_conversion
            }
          ].freeze

          private_constant :DBUS_PROPERTIES

          # Issues detected in the D-Bus volume, see {HashValidator#issues}.
          #
          # @return [Array<String>]
          def dbus_volume_issues
            validator.issues
          end

          # D-Bus properties with valid type, see {HashValidator#valid_keys}.
          #
          # @return [Array<String>]
          def valid_dbus_properties
            validator.valid_keys
          end

          # Validator for D-Bus volume.
          #
          # @return [HashValidator]
          def validator
            return @validator if @validator

            scheme = DBUS_PROPERTIES.map { |p| [p[:name], p[:type]] }.to_h
            @validator = HashValidator.new(dbus_volume, scheme: scheme)
          end

          # @param target [Agama::Storage::Volume]
          # @param dbus_property_name [String]
          def conversion(target, dbus_property_name)
            dbus_property = DBUS_PROPERTIES.find { |d| d[:name] == dbus_property_name }
            send(dbus_property[:conversion], target, dbus_volume[dbus_property_name])
          end

          # @param target [Agama::Storage::Volume]
          # @param value [String]
          def mount_path_conversion(target, value)
            target.mount_path = value
          end

          # @param target [Agama::Storage::Volume]
          # @param value [Array<String>]
          def mount_options_conversion(target, value)
            target.mount_options = value
          end

          # @param target [Agama::Storage::Volume]
          # @param value [String]
          def target_device_conversion(target, value)
            target.location.device = value
          end

          # @param target [Agama::Storage::Volume]
          # @param value [String]
          def target_conversion(target, value)
            target_value = value.downcase.to_sym
            return unless Agama::Storage::VolumeLocation.targets.include?(target_value)

            target.location.target = target_value
          end

          # @param target [Agama::Storage::Volume]
          # @param value [String]
          def fs_type_conversion(target, value)
            downcase_value = value.downcase

            fs_type = target.outline.filesystems.find do |type|
              type.to_human_string.downcase == downcase_value
            end

            return unless fs_type

            target.fs_type = fs_type
          end

          # @param target [Agama::Storage::Volume]
          # @param value [Integer] Size in bytes.
          def min_size_conversion(target, value)
            target.min_size = Y2Storage::DiskSize.new(value)
          end

          # @param target [Agama::Storage::Volume]
          # @param value [Integer] Size in bytes.
          def max_size_conversion(target, value)
            target.max_size = Y2Storage::DiskSize.new(value)
          end

          # @param target [Agama::Storage::Volume]
          # @param value [Boolean]
          def auto_size_conversion(target, value)
            return unless target.auto_size_supported?

            target.auto_size = value
          end

          # @param target [Agama::Storage::Volume]
          # @param value [Booelan]
          def snapshots_conversion(target, value)
            return unless target.outline.snapshots_configurable?

            target.btrfs.snapshots = value
          end
        end
      end
    end
  end
end
