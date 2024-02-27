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
          # @return [Hash]
          def convert
            target = {}

            DBUS_PROPERTIES.each do |dbus_property, conversion|
              target[dbus_property] = send(conversion)
            end

            target
          end

        private

          # @return [Agama::Storage::ProposalSettings]
          attr_reader :settings

          DBUS_PROPERTIES = {
            "TargetDevice"           => :target_device_conversion,
            "BootDevice"             => :boot_device_conversion,
            "LVM"                    => :lvm_conversion,
            "SystemVGDevices"        => :system_vg_devices_conversion,
            "EncryptionPassword"     => :encryption_password_conversion,
            "EncryptionMethod"       => :encryption_method_conversion,
            "EncryptionPBKDFunction" => :encryption_pbkd_function_conversion,
            "SpacePolicy"            => :space_policy_conversion,
            "SpaceActions"           => :space_actions_conversion,
            "Volumes"                => :volumes_conversion
          }.freeze

          private_constant :DBUS_PROPERTIES

          # @return [String]
          def target_device_conversion
            settings.target_device.to_s
          end

          # @return [String]
          def boot_device_conversion
            settings.boot_device.to_s
          end

          # @return [Boolean]
          def lvm_conversion
            settings.lvm.enabled?
          end

          # @return [Array<String>]
          def system_vg_devices_conversion
            settings.lvm.system_vg_devices
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

          # @return [Array<Hash>]
          def space_actions_conversion
            settings.space.actions.each_with_object([]) do |(device, action), actions|
              actions << { "Device" => device, "Action" => action.to_s }
            end
          end

          # @return [Array<Hash>]
          def volumes_conversion
            settings.volumes.map { |v| VolumeConversion.to_dbus(v) }
          end
        end
      end
    end
  end
end
