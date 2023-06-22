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
require "agama/dbus/base_object"

module Agama
  module DBus
    module Storage
      # Class for D-Bus object representing a zFCP disk
      class ZFCPDisk < BaseObject
        # zFCP disk represented by the D-Bus object
        #
        # @return [Agama::Storage::ZFCP::Disk]
        attr_reader :disk

        # Constructor
        #
        # @param disk [Agama::Storage::ZFCP::Disk]
        # @param path [DBus::ObjectPath] Path in which the object is exported
        # @param logger [Logger, nil]
        def initialize(disk, path, logger: nil)
          super(path, logger: logger)

          @disk = disk
        end

        # Device name
        #
        # @return [String] e.g., "/dev/sda"
        def name
          disk.name || ""
        end

        # zFCP controller channel id
        #
        # @return [String]
        def channel
          disk.channel || ""
        end

        # zFCP WWPN
        #
        # @return [String]
        def wwpn
          disk.wwpn || ""
        end

        # zFCP LUN
        #
        # @return [String]
        def lun
          disk.lun || ""
        end

        # Sets the represented zFCP disk
        #
        # @note A properties changed signal is emitted if the disk changes.
        #
        # @param value [Agama::Storage::ZFCP::Disk]
        def disk=(value)
          emit_signal = disk != value

          @disk = value
          return unless emit_signal

          properties = interfaces_and_properties[ZFCP_DISK_INTERFACE]
          dbus_properties_changed(ZFCP_DISK_INTERFACE, properties, [])
        end

        ZFCP_DISK_INTERFACE = "org.opensuse.Agama.Storage1.ZFCP.Disk"
        private_constant :ZFCP_DISK_INTERFACE

        dbus_interface ZFCP_DISK_INTERFACE do
          dbus_reader(:name, "s")
          dbus_reader(:channel, "s")
          dbus_reader(:wwpn, "s", dbus_name: "WWPN")
          dbus_reader(:lun, "s", dbus_name: "LUN")
        end
      end
    end
  end
end
