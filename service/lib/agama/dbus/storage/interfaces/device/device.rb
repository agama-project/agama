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
require "y2storage/device_description"

module Agama
  module DBus
    module Storage
      module Interfaces
        module Device
          # Interface for a device.
          #
          # @note This interface is intended to be included by {Agama::DBus::Storage::Device}.
          module Device
            # Whether this interface should be implemented for the given device.
            #
            # @note All devices implement this interface.
            #
            # @param _storage_device [Y2Storage::Device]
            # @return [Boolean]
            def self.apply?(_storage_device)
              true
            end

            DEVICE_INTERFACE = "org.opensuse.Agama.Storage1.Device"
            private_constant :DEVICE_INTERFACE

            # sid of the device.
            #
            # @return [Integer]
            def device_sid
              storage_device.sid
            end

            # Name of the device.
            #
            # @return [String] e.g., "/dev/sda".
            def device_name
              storage_device.name
            end

            # Description of the device.
            #
            # @return [String] e.g., "EXT4 Partition".
            def device_description
              Y2Storage::DeviceDescription.new(storage_device).to_s
            end

            def self.included(base)
              base.class_eval do
                dbus_interface DEVICE_INTERFACE do
                  dbus_reader :device_sid, "u", dbus_name: "SID"
                  dbus_reader :device_name, "s", dbus_name: "Name"
                  dbus_reader :device_description, "s", dbus_name: "Description"
                end
              end
            end
          end
        end
      end
    end
  end
end
