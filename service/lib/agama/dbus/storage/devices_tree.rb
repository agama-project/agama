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

require "dbus/object_path"
require "agama/dbus/storage/device"

module Agama
  module DBus
    module Storage
      # Class representing a storage devices tree exported on D-Bus
      class DevicesTree
        # Constructor
        #
        # @param service [::DBus::ObjectServer]
        # @param root_path [::DBus::ObjectPath]
        # @param logger [Logger, nil]
        def initialize(service, root_path, logger: nil)
          @service = service
          @root_path = root_path
          @logger = logger
        end

        # Object path for the D-Bus object representing the given device
        #
        # @param device [Y2Storage::Device]
        # @return [::DBus::ObjectPath]
        def path_for(device)
          ::DBus::ObjectPath.new(File.join(root_path, device.sid.to_s))
        end

        # Updates the D-Bus tree according to the given devicegraph
        #
        # The current D-Bus nodes are all unexported.
        #
        # @param devicegraph [Y2Storage::Devicegraph]
        def update(devicegraph)
          unexport_devices
          export_devices(devicegraph)
        end

      private

        # @return [::DBus::ObjectServer]
        attr_reader :service

        # @return [::DBus::ObjectPath]
        attr_reader :root_path

        # @return [Logger]
        attr_reader :logger

        # Exports a D-Bus object for each storage device.
        #
        # Right now, only the required information for calculating a proposal is exported, that is:
        # * Information about the potential candidate devices (i.e., disk devices, MDs).
        # * Information about the partitions of the candidate devices in order to indicate how to
        #   find free space.
        #
        # TODO: export LVM VGs and file systems of directly formatted devices.
        #
        # @param devicegraph [Y2Storage::Devicegraph]
        def export_devices(devicegraph)
          devices = devicegraph.disk_devices + devicegraph.software_raids

          (devices + partitions_from(devices)).each { |d| export_device(d) }
        end

        # Exports a D-Bus object for the given device
        #
        # @param device [Y2Storage::Device]
        def export_device(device)
          dbus_node = Device.new(device, path_for(device), self, logger: logger)
          service.export(dbus_node)
        end

        # Unexports the currently exported D-Bus objects
        def unexport_devices
          dbus_objects.each { |n| service.unexport(n) }
        end

        # All exported D-Bus objects
        #
        # @return [Array<Device>]
        def dbus_objects
          root = service.get_node(root_path, create: false)
          return [] unless root

          root.descendant_objects
        end

        # All partitions of the given devices.
        #
        # @param devices [Array<Y2Storage::Device>]
        # @return [Array<Y2Storage::Partition>]
        def partitions_from(devices)
          devices.select { |d| d.is?(:blk_device) && d.respond_to?(:partitions) }
            .flat_map(&:partitions)
        end
      end
    end
  end
end
