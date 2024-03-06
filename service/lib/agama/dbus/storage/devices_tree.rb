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

require "agama/dbus/base_tree"
require "agama/dbus/storage/device"
require "dbus/object_path"

module Agama
  module DBus
    module Storage
      # Class representing a storage devices tree exported on D-Bus
      class DevicesTree < BaseTree
        # Object path for the D-Bus object representing the given device
        #
        # @param device [Y2Storage::Device]
        # @return [::DBus::ObjectPath]
        def path_for(device)
          ::DBus::ObjectPath.new(File.join(root_path, device.sid.to_s))
        end

        # Updates the D-Bus tree according to the given devicegraph.
        #
        # @note In the devices tree it is important to avoid updating D-Bus nodes. Note that an
        #   already exported D-Bus object could require to add or remove interfaces (e.g., an
        #   existing partition needs to add the Filesystem interface after formatting the
        #   partition). Dynamically adding or removing intefaces is not possible with ruby-dbus
        #   once the object is exported on D-Bus.
        #
        #   Updating the currently exported D-Bus objects is avoided by calling to {#clean} first.
        #
        # @param devicegraph [Y2Storage::Devicegraph]
        def update(devicegraph)
          clean
          self.objects = devices(devicegraph)
        end

      private

        # @see BaseTree
        # @param device [Y2Storage::Device]
        def create_dbus_object(device)
          Device.new(device, path_for(device), self, logger: logger)
        end

        # @see BaseTree
        #
        # @note D-Bus objects representing devices cannot be safely updated, see {#update}.
        def update_dbus_object(_dbus_object, _device)
          nil
        end

        # @see BaseTree
        # @param dbus_object [Device]
        # @param device [Y2Storage::Device]
        def dbus_object?(dbus_object, device)
          dbus_object.sid == device.sid
        end

        # Devices to be exported.
        #
        # Right now, only the required information for calculating a proposal is exported, that is:
        # * Potential candidate devices (i.e., disk devices, MDs).
        # * Partitions of the candidate devices in order to indicate how to find free space.
        # * LVM volume groups and logical volumes.
        #
        # @param devicegraph [Y2Storage::Devicegraph]
        # @return [Array<Y2Storage::Device>]
        def devices(devicegraph)
          devices = devicegraph.disk_devices +
            devicegraph.software_raids +
            devicegraph.lvm_vgs +
            devicegraph.lvm_lvs

          devices + partitions_from(devices)
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
