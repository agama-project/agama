# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

module Agama
  module DBus
    module Storage
      module ProposalSettingsConversion
        # Utility class offering methods to convert volumes between Agama and D-Bus formats
        #
        # @note In the future this class might be not needed if proposal volumes and templates are
        #   exported as objects in D-Bus.
        class ToDBus
          def initialize(settings)
            @settings = settings
          end

          def convert
            {
              "BootDevice"              => settings.boot_device.to_s,
              "LVM"                     => settings.lvm,
              "SystemVGDevices"         => settings.lvm.system_vg_devices,
              "EncryptionPassword"      => settings.encryption.password,
              "EncryptionMethod"        => settings.encryption.method.id,
              "EncryptionPBKDFunction"  => settings.encryption.pbkd_function&.value || "",
              "SpacePolicy"             => settings.space.policy.to_s,
              "SpaceActions"            => settings.space.actions,
              "Volumes"                 => settings.volumes.map { |v| VolumeConversion.to_dbus(v) }
            }
          end

        private

          attr_reader :settings
        end
      end
    end
  end
end
