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

require "dbus"

module Agama
  module DBus
    module Storage
      module Interfaces
        # Interface for drive devices
        #
        # @note This interface is intended to be included by {Device} if needed.
        module Drive
          DRIVE_INTERFACE = "org.opensuse.Agama.Storage1.Drive"
          private_constant :DRIVE_INTERFACE

          # Drive type
          #
          # @return ["disk", "raid", "multipath", "dasd"]
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
