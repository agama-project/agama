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
            {
              "TargetDevice"           => settings.target_device.to_s,
              "BootDevice"             => settings.boot_device.to_s,
              "LVM"                    => settings.lvm.enabled?,
              "SystemVGDevices"        => settings.lvm.system_vg_devices,
              "EncryptionPassword"     => settings.encryption.password.to_s,
              "EncryptionMethod"       => settings.encryption.method.id.to_s,
              "EncryptionPBKDFunction" => settings.encryption.pbkd_function&.value || "",
              "SpacePolicy"            => settings.space.policy.to_s,
              "SpaceActions"           => space_actions_conversion,
              "Volumes"                => settings.volumes.map { |v| VolumeConversion.to_dbus(v) }
            }
          end

        private

          # @return [Agama::Storage::ProposalSettings]
          attr_reader :settings

          # @return [Array<Hash>]
          def space_actions_conversion
            settings.space.actions.each_with_object([]) do |(device, action), actions|
              actions << { "Device" => device, "Action" => action.to_s }
            end
          end
        end
      end
    end
  end
end
