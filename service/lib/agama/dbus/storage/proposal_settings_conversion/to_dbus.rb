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

require "agama/dbus/storage/volume_conversion"
require "agama/storage/device_settings"

module Agama
  module DBus
    module Storage
      module ProposalSettingsConversion
        # Proposal settings conversion to D-Bus format.
        class ToDBus
          # @param settings [Agama::Storage::ProposalSettings]
          def initialize(settings)
            @settings = settings
          end

          # Performs the conversion to D-Bus format.
          #
          # @return [Hash<String, Object>]
          #   * "Target" [String]
          #   * "TargetDevice" [String] Optional
          #   * "TargetPVDevices" [Array<String>] Optional
          #   * "ConfigureBoot" [Boolean]
          #   * "BootDevice" [String]
          #   * "DefaultBootDevice" [String]
          #   * "EncryptionPassword" [String]
          #   * "EncryptionMethod" [String]
          #   * "EncryptionPBKDFunction" [String]
          #   * "SpacePolicy" [String]
          #   * "SpaceActions" [Array<Hash>] see {#space_actions_conversion}
          #   * "Volumes" [Array<Hash>] see {#volumes_conversion}
          def convert
            target = device_conversion

            DBUS_PROPERTIES.each do |dbus_property, conversion|
              target[dbus_property] = send(conversion)
            end

            target
          end

        private

          # @return [Agama::Storage::ProposalSettings]
          attr_reader :settings

          DBUS_PROPERTIES = {
            "ConfigureBoot"          => :configure_boot_conversion,
            "BootDevice"             => :boot_device_conversion,
            "DefaultBootDevice"      => :default_boot_device_conversion,
            "EncryptionPassword"     => :encryption_password_conversion,
            "EncryptionMethod"       => :encryption_method_conversion,
            "EncryptionPBKDFunction" => :encryption_pbkd_function_conversion,
            "SpacePolicy"            => :space_policy_conversion,
            "SpaceActions"           => :space_actions_conversion,
            "Volumes"                => :volumes_conversion
          }.freeze

          private_constant :DBUS_PROPERTIES

          # @return [Hash]
          def device_conversion
            device_settings = settings.device

            case device_settings
            when Agama::Storage::DeviceSettings::Disk
              disk_device_conversion(device_settings)
            when Agama::Storage::DeviceSettings::NewLvmVg
              new_lvm_vg_device_conversion(device_settings)
            when Agama::Storage::DeviceSettings::ReusedLvmVg
              reused_lvm_vg_device_conversion(device_settings)
            end
          end

          # @param device_settings [Agama::Storage::DeviceSettings::Disk]
          # @return [Hash]
          def disk_device_conversion(device_settings)
            {
              "Target"       => "disk",
              "TargetDevice" => device_settings.name || ""
            }
          end

          # @param device_settings [Agama::Storage::DeviceSettings::NewLvmVg]
          # @return [Hash]
          def new_lvm_vg_device_conversion(device_settings)
            {
              "Target"          => "newLvmVg",
              "TargetPVDevices" => device_settings.candidate_pv_devices
            }
          end

          # @param device_settings [Agama::Storage::DeviceSettings::Disk]
          # @return [Hash]
          def reused_lvm_vg_device_conversion(device_settings)
            {
              "Target"       => "reusedLvmVg",
              "TargetDevice" => device_settings.name || ""
            }
          end

          # @return [Boolean]
          def configure_boot_conversion
            settings.boot.configure?
          end

          # @return [String]
          def boot_device_conversion
            settings.boot.device || ""
          end

          # @return [String]
          def default_boot_device_conversion
            settings.default_boot_device || ""
          end

          # @return [String]
          def encryption_password_conversion
            settings.encryption.password.to_s
          end

          # @return [String]
          def encryption_method_conversion
            settings.encryption.method.id.to_s
          end

          # @return [String]
          def encryption_pbkd_function_conversion
            settings.encryption.pbkd_function&.value || ""
          end

          # @return [String]
          def space_policy_conversion
            settings.space.policy.to_s
          end

          # @return [Array<Hash<String, Object>>]
          #   For each action:
          #   * "Device" [String]
          #   * "Action" [String]
          def space_actions_conversion
            settings.space.actions.each_with_object([]) do |(device, action), actions|
              actions << { "Device" => device, "Action" => action.to_s }
            end
          end

          # @return [Array<Hash>] see {VolumeConversion::ToDBus}.
          def volumes_conversion
            settings.volumes.map { |v| VolumeConversion.to_dbus(v) }
          end
        end
      end
    end
  end
end
