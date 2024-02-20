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
require "agama/dbus/base_object"
require "agama/dbus/storage/interfaces/device"

module Agama
  module DBus
    module Storage
      # Class for D-Bus objects representing a storage device (e.g., Disk, Partition, VG, etc).
      #
      # The D-Bus object includes the required interfaces for the storage object that it represents.
      class Device < BaseObject
        # @return [Y2Storage::Device]
        attr_reader :storage_device

        # Constructor
        #
        # @param storage_device [Y2Storage::Device] Storage device
        # @param path [::DBus::ObjectPath] Path for the D-Bus object
        # @param tree [DevicesTree] D-Bus tree in which the device is exported
        # @param logger [Logger, nil]
        def initialize(storage_device, path, tree, logger: nil)
          super(path, logger: logger)

          @storage_device = storage_device
          @tree = tree
          add_interfaces
        end

        # Sets the represented storage device.
        #
        # @note A properties changed signal is emitted for each interface.
        # @raise [RuntimeError] If the given device has a different sid.
        #
        # @param value [Y2Storage::Device]
        def storage_device=(value)
          if value.sid != storage_device.sid
            raise "Cannot update the D-Bus object because the given device has a different sid: " \
                  "#{value} instead of #{storage_device.sid}"
          end

          @storage_device = value

          interfaces_and_properties.each do |interface, properties|
            dbus_properties_changed(interface, properties, [])
          end
        end

      private

        # @return [DevicesTree]
        attr_reader :tree

        # Adds the required interfaces according to the storage object.
        def add_interfaces
          interfaces = Interfaces::Device.constants
            .map { |c| Interfaces::Device.const_get(c) }
            .select { |c| c.is_a?(Module) && c.respond_to?(:apply?) && c.apply?(storage_device) }

          interfaces.each { |i| singleton_class.include(i) }
        end
      end
    end
  end
end
