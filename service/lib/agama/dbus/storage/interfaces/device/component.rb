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

require "dbus"

module Agama
  module DBus
    module Storage
      module Interfaces
        module Device
          # Interface for devices that are used as component of other device (e.g., physical volume,
          # MD RAID device, etc).
          #
          # @note This interface is intended to be included by {Agama::DBus::Storage::Device} if
          #   needed.
          module Component
            # Whether this interface should be implemented for the given device.
            #
            # @note Components of other devices implement this interface.
            #
            # @param storage_device [Y2Storage::Device]
            # @return [Boolean]
            def self.apply?(storage_device)
              storage_device.is?(:blk_device) && storage_device.component_of.any?
            end

            COMPONENT_INTERFACE = "org.opensuse.Agama.Storage1.Component"
            private_constant :COMPONENT_INTERFACE

            # Type of component.
            #
            # @return ["physical_volume", "md_device", "raid_device", "multipath_wire",
            #   "bcache_device", "bcache_cset_device", "md_btrfs_device", ""] Empty if type is
            #   unknown.
            def component_type
              types = {
                lvm_vg:      "physical_volume",
                md:          "md_device",
                dm_raid:     "raid_device",
                multipath:   "multipath_wire",
                bcache:      "bcache_device",
                bcache_cset: "bcache_cset_device",
                btrfs:       "md_btrfs_device"
              }

              device = storage_device.component_of.first

              types.find { |k, _v| device.is?(k) }&.last || ""
            end

            # Name of the devices for which this device is component of.
            #
            # @return [Array<String>]
            def component_device_names
              storage_device.component_of.map(&:display_name).compact
            end

            # Paths of the D-Bus objects representing the devices.
            #
            # @return [Array<::DBus::ObjectPath>]
            def component_devices
              storage_device.component_of.map { |p| tree.path_for(p) }
            end

            def self.included(base)
              base.class_eval do
                dbus_interface COMPONENT_INTERFACE do
                  dbus_reader :component_type, "s", dbus_name: "Type"
                  # The names are provided just in case the device is component of a device that
                  # is not exported yet (e.g., Bcache devices).
                  dbus_reader :component_device_names, "as", dbus_name: "DeviceNames"
                  dbus_reader :component_devices, "ao", dbus_name: "Devices"
                end
              end
            end
          end
        end
      end
    end
  end
end
