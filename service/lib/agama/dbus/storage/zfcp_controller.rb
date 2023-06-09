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
      # Class for D-Bus object representing a zFCP controller
      class ZFCPController < BaseObject
        # @return [Agama::Storage::ZFCP::Manager]
        attr_reader :zfcp_manager

        # zFCP controller represented by the D-Bus object
        #
        # @return [Agama::Storage::ZFCP::Controller]
        attr_reader :controller

        # Constructor
        #
        # @param zfcp_manager [Agama::Storage::ZFCP::Manager]
        # @param controller [Agama::Storage::ZFCP::Controller]
        # @param path [DBus::ObjectPath] Path in which the object is exported
        # @param logger [Logger, nil]
        def initialize(zfcp_manager, controller, path, logger: nil)
          super(path, logger: logger)

          @zfcp_manager = zfcp_manager
          @controller = controller
        end

        # Whether the controller is active
        #
        # @return [Boolean]
        def active
          controller.active?
        end

        # zFCP channel id
        #
        # @return [String]
        def channel
          controller.channel || ""
        end

        # Available WWPNs
        #
        # @return [Array<String>]
        def find_wwpns
          zfcp_manager.find_wwpns(controller.channel)
        end

        # Available LUNs
        #
        # @param wwpn [String]
        # @return [Array<String>]
        def find_luns(wwpn)
          zfcp_manager.find_luns(controller.channel, wwpn)
        end

        # Activates the controller
        #
        # @note: If "allow_lun_scan" is active, then all LUNs are automatically activated.
        #
        # @return [Integer] Exit code of the chzdev command
        def activate
          zfcp_manager.activate_controller(controller.channel)
        end

        # Activates a zFCP disk
        #
        # @param wwpn [String]
        # @param lun [String]
        #
        # @return [Integer] Exit code of the chzdev command
        def activate_disk(wwpn, lun)
          zfcp_manager.activate_disk(controller.channel, wwpn, lun)
        end

        # Deactivates a zFCP disk
        #
        # @note: If "allow_lun_scan" is active, then the disk cannot be deactivated.
        #
        # @param wwpn [String]
        # @param lun [String]
        #
        # @return [Integer] Exit code of the chzdev command
        def deactivate_disk(wwpn, lun)
          zfcp_manager.deactivate_disk(controller.channel, wwpn, lun)
        end

        # Sets the represented zFCP controller
        #
        # @note A properties changed signal is emitted if the controller changes.
        #
        # @param value [Agama::Storage::ZFCP::Controller]
        def controller=(value)
          emit_signal = controller != value

          @controller = value
          return unless emit_signal

          properties = interfaces_and_properties[ZFCP_CONTROLLER_INTERFACE]
          dbus_properties_changed(ZFCP_CONTROLLER_INTERFACE, properties, [])
        end

        ZFCP_CONTROLLER_INTERFACE = "org.opensuse.Agama.Storage1.ZFCP.Controller"
        private_constant :ZFCP_CONTROLLER_INTERFACE

        # This interface does not have a method to deactivate a controller (controller deactivation
        # could be problematic). For more details see https://github.com/openSUSE/agama/pull/594.
        dbus_interface ZFCP_CONTROLLER_INTERFACE do
          # @see #active
          dbus_reader(:active, "b")

          # @see #channel
          dbus_reader(:channel, "s")

          # @see #find_wwpns
          dbus_method(:GetWWPNs, "out result:as") { [find_wwpns] }

          # @see #find_luns
          dbus_method(:GetLUNs, "in wwpn:s, out result:as") { |wwpn| [find_luns(wwpn)] }

          # @see activate
          dbus_method(:Activate, "out result:u") { activate }

          # @see activate_disk
          dbus_method(:ActivateDisk, "in wwpn:s, in lun:s, out result:u") do |wwpn, lun|
            activate_disk(wwpn, lun)
          end

          # @see #deactivate_disk
          dbus_method(:DeactivateDisk, "in wwpn:s, in lun:s, out result:u") do |wwpn, lun|
            deactivate_disk(wwpn, lun)
          end
        end
      end
    end
  end
end
