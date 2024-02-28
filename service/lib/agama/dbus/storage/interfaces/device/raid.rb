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

require "dbus"

module Agama
  module DBus
    module Storage
      module Interfaces
        module Device
          # Interface for DM RAID devices.
          #
          # @note This interface is intended to be included by {Agama::DBus::Storage::Device} if
          #   needed.
          module Raid
            # Whether this interface should be implemented for the given device.
            #
            # @note DM RAIDs implement this interface.
            #
            # @param storage_device [Y2Storage::Device]
            # @return [Boolean]
            def self.apply?(storage_device)
              storage_device.is?(:dm_raid)
            end

            RAID_INTERFACE = "org.opensuse.Agama.Storage1.RAID"
            private_constant :RAID_INTERFACE

            # Paths of the D-Bus objects representing the devices used by the DM RAID.
            #
            # @return [Array<String>]
            def raid_devices
              storage_device.parents.map { |p| tree.path_for(p) }
            end

            def self.included(base)
              base.class_eval do
                dbus_interface RAID_INTERFACE do
                  dbus_reader :raid_devices, "ao", dbus_name: "Devices"
                end
              end
            end
          end
        end
      end
    end
  end
end
