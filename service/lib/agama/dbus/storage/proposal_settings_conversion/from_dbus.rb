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
require "agama/dbus/storage/volume_conversion"
require "agama/dbus/types"
require "agama/storage/device_settings"
require "agama/storage/proposal_settings"
require "agama/storage/proposal_settings_reader"
require "agama/storage/space_settings"
require "y2storage/encryption_method"
require "y2storage/pbkd_function"

module Agama
  module DBus
    module Storage
      module ProposalSettingsConversion
        # Proposal settings conversion from D-Bus format.
        class FromDBus
          # @param dbus_settings [Hash]
          # @param config [Agama::Config]
          # @param logger [Logger, nil]
          def initialize(dbus_settings, config:, logger: nil)
            @dbus_settings = dbus_settings
            @config = config
            @logger = logger || Logger.new($stdout)
          end

          # Performs the conversion from D-Bus format.
          #
          # @return [Agama::Storage::ProposalSettings]
          def convert
            logger.info("D-Bus settings: #{dbus_settings}")

            dbus_settings_issues.each { |i| logger.warn(i) }

            Agama::Storage::ProposalSettingsReader.new(config).read.tap do |target|
              valid_dbus_properties.each { |p| conversion(target, p) }
            end
          end

        private

          # @return [Hash]
          attr_reader :dbus_settings

          # @return [Agama::Config]
          attr_reader :config

          # @return [Logger]
          attr_reader :logger

          DBUS_PROPERTIES = [
            {
              name:       "Target",
              type:       String,
              conversion: :device_conversion
            },
            {
              name: "TargetDevice",
              type: String
            },
            {
              name: "TargetPVDevices",
              type: Types::Array.new(String)
            },
            {
              name:       "ConfigureBoot",
              type:       Types::BOOL,
              conversion: :configure_boot_conversion
            },
            {
              name:       "BootDevice",
              type:       String,
              conversion: :boot_device_conversion
            },
            {
              name:       "EncryptionPassword",
              type:       String,
              conversion: :encryption_password_conversion
            },
            {
              name:       "EncryptionMethod",
              type:       String,
              conversion: :encryption_method_conversion
            },
            {
              name:       "EncryptionPBKDFunction",
              type:       String,
              conversion: :encryption_pbkd_function_conversion
            },
            {
              name:       "SpacePolicy",
              type:       String,
              conversion: :space_policy_conversion
            },
            {
              name:       "SpaceActions",
              type:       Types::Array.new(Types::Hash.new(key: String, value: String)),
              conversion: :space_actions_conversion
            },
            {
              name:       "Volumes",
              type:       Types::Array.new(Types::Hash.new(key: String)),
              conversion: :volumes_conversion
            }
          ].freeze

          private_constant :DBUS_PROPERTIES

          # Issues detected in the D-Bus settings, see {HashValidator#issues}.
          #
          # @return [Array<String>]
          def dbus_settings_issues
            validator.issues
          end

          # D-Bus properties with valid type, see {HashValidator#valid_keys}.
          #
          # @return [Array<String>]
          def valid_dbus_properties
            validator.valid_keys
          end

          # Validator for D-Bus settings.
          #
          # @return [HashValidator]
          def validator
            return @validator if @validator

            scheme = DBUS_PROPERTIES.map { |p| [p[:name], p[:type]] }.to_h
            @validator = HashValidator.new(dbus_settings, scheme: scheme)
          end

          # @param target [Agama::Storage::ProposalSettings]
          # @param dbus_property_name [String]
          def conversion(target, dbus_property_name)
            dbus_property = DBUS_PROPERTIES.find { |d| d[:name] == dbus_property_name }
            conversion_method = dbus_property[:conversion]

            return unless conversion_method

            send(conversion_method, target, dbus_settings[dbus_property_name])
          end

          # @param target [Agama::Storage::ProposalSettings]
          # @param value [String]
          def device_conversion(target, value)
            device_settings = case value
            when "disk"
              disk_device_conversion
            when "newLvmVg"
              new_lvm_vg_device_conversion
            when "reusedLvmVg"
              reused_lvm_vg_device_conversion
            end

            target.device = device_settings
          end

          # @return [Agama::Storage::DeviceSettings::Disk]
          def disk_device_conversion
            device = dbus_settings["TargetDevice"]
            Agama::Storage::DeviceSettings::Disk.new(device)
          end

          # @return [Agama::Storage::DeviceSettings::NewLvmVg]
          def new_lvm_vg_device_conversion
            candidates = dbus_settings["TargetPVDevices"] || []
            Agama::Storage::DeviceSettings::NewLvmVg.new(candidates)
          end

          # @return [Agama::Storage::DeviceSettings::ReusedLvmVg]
          def reused_lvm_vg_device_conversion
            device = dbus_settings["TargetDevice"]
            Agama::Storage::DeviceSettings::ReusedLvmVg.new(device)
          end

          # @param target [Agama::Storage::ProposalSettings]
          # @param value [Boolean]
          def configure_boot_conversion(target, value)
            target.boot.configure = value
          end

          # @param target [Agama::Storage::ProposalSettings]
          # @param value [String]
          def boot_device_conversion(target, value)
            target.boot.device = value.empty? ? nil : value
          end

          # @param target [Agama::Storage::ProposalSettings]
          # @param value [String]
          def encryption_password_conversion(target, value)
            target.encryption.password = value.empty? ? nil : value
          end

          # @param target [Agama::Storage::ProposalSettings]
          # @param value [String]
          def encryption_method_conversion(target, value)
            method = Y2Storage::EncryptionMethod.find(value.to_sym)
            return unless method

            target.encryption.method = method
          end

          # @param target [Agama::Storage::ProposalSettings]
          # @param value [String]
          def encryption_pbkd_function_conversion(target, value)
            function = Y2Storage::PbkdFunction.find(value)
            return unless function

            target.encryption.pbkd_function = function
          end

          # @param target [Agama::Storage::ProposalSettings]
          # @param value [String]
          def space_policy_conversion(target, value)
            policy = value.to_sym
            return unless Agama::Storage::SpaceSettings.policies.include?(policy)

            target.space.policy = policy
          end

          # @param target [Agama::Storage::ProposalSettings]
          # @param value [Array<Hash>]
          def space_actions_conversion(target, value)
            target.space.actions = value.each_with_object({}) do |v, result|
              result[v["Device"]] = v["Action"].to_sym
            end
          end

          # @param target [Agama::Storage::ProposalSettings]
          # @param value [Array<Hash>]
          def volumes_conversion(target, value)
            # Keep default volumes if no volumes are given
            return if value.empty?

            required_volumes = target.volumes.select { |v| v.outline.required? }
            volumes = value.map do |dbus_volume|
              VolumeConversion.from_dbus(dbus_volume, config: config, logger: logger)
            end

            target.volumes = volumes + missing_volumes(required_volumes, volumes)
          end

          # Missing required volumes
          #
          # @param required_volumes [Array<Agama::Storage::Volume>]
          # @param volumes [Array<Agama::Storage::Volume>]
          #
          # @return [Array<Agama::Storage::Volume>]
          def missing_volumes(required_volumes, volumes)
            mount_paths = volumes.map(&:mount_path)

            required_volumes.reject { |v| mount_paths.include?(v.mount_path) }
          end
        end
      end
    end
  end
end
