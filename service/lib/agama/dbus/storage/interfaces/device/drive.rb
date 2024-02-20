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
          # Interface for drive devices.
          #
          # @note This interface is intended to be included by {Agama::DBus::Storage::Device} if
          #   needed.
          module Drive
            # Whether this interface should be implemented for the given device.
            #
            # @note Drive devices implement this interface.
            #   Drive and disk device are very close concepts, but there are subtle differences. For
            #   example, a MD RAID is never considered as a drive.
            #
            # TODO: Revisit the defintion of drive. Maybe some MD devices could implement the drive
            #   interface if hwinfo provides useful information for them.
            #
            # @param storage_device [Y2Storage::Device]
            # @return [Boolean]
            def self.apply?(storage_device)
              storage_device.is?(:disk, :dm_raid, :multipath, :dasd) &&
                storage_device.is?(:disk_device)
            end

            DRIVE_INTERFACE = "org.opensuse.Agama.Storage1.Drive"
            private_constant :DRIVE_INTERFACE

            # Drive type
            #
            # @return ["disk", "raid", "multipath", "dasd", ""] Empty if type is unknown.
            def drive_type
              if storage_device.is?(:disk)
                "disk"
              elsif storage_device.is?(:dm_raid)
                "raid"
              elsif storage_device.is?(:multipath)
                "multipath"
              elsif storage_device.is?(:dasd)
                "dasd"
              else
                ""
              end
            end

            # Vendor name
            #
            # @return [String]
            def drive_vendor
              storage_device.vendor || ""
            end

            # Model name
            #
            # @return [String]
            def drive_model
              storage_device.model || ""
            end

            # Bus name
            #
            # @return [String]
            def drive_bus
              storage_device.bus || ""
            end

            # Bus Id for DASD
            #
            # @return [String]
            def drive_bus_id
              return "" unless storage_device.respond_to?(:bus_id)

              storage_device.bus_id
            end

            # Kernel drivers used by the device
            #
            # @return [Array<String>]
            def drive_driver
              storage_device.driver
            end

            # Data transport layer, if any
            #
            # @return [String]
            def drive_transport
              return "" unless storage_device.respond_to?(:transport)

              storage_device.transport.to_s
            end

            # More info about the device
            #
            # @return [Hash]
            def drive_info
              {
                "SDCard"   => storage_device.sd_card?,
                "DellBOSS" => storage_device.boss?
              }
            end

            def self.included(base)
              base.class_eval do
                dbus_interface DRIVE_INTERFACE do
                  dbus_reader :drive_type, "s", dbus_name: "Type"
                  dbus_reader :drive_vendor, "s", dbus_name: "Vendor"
                  dbus_reader :drive_model, "s", dbus_name: "Model"
                  dbus_reader :drive_bus, "s", dbus_name: "Bus"
                  dbus_reader :drive_bus_id, "s", dbus_name: "BusId"
                  dbus_reader :drive_driver, "as", dbus_name: "Driver"
                  dbus_reader :drive_transport, "s", dbus_name: "Transport"
                  dbus_reader :drive_info, "a{sv}", dbus_name: "Info"
                end
              end
            end
          end
        end
      end
    end
  end
end
