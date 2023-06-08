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
require "forwardable"

module Agama
  module DBus
    module Storage
      # Class representing [...]
      class FcoeInterface < BaseObject
        # @return [Agama::Storage::Fcoe::Manager]
        attr_reader :fcoe_manager

        # @return [Agama::Storage::Fcoe::Interface]
        attr_reader :interface

        # Constructor
        #
        # @param fcoe_manager [Agama::Storage::Fcoe::Manager]
        # @param interface [Agama::Storage::Fcoe::Interface]
        # @param path [DBus::ObjectPath] Path in which the object is exported
        # @param logger [Logger, nil]
        def initialize(fcoe_manager, interface, path, logger: nil)
          super(path, logger: logger)

          @fcoe_manager = fcoe_manager
          @interface = interface
        end

        def_delegators :interface, :parent_device, :vlan_id, :model, :driver,
          :dcb_capable, :fcoe_vlan_possible, :fcoe_vlan

        def fcoe_vlan_device
          fcoe_vlan ? fcoe_vlan.device : ""
        end

        def fcoe_service
          !!(fcoe_vlan&.fcoe_service)
        end

        def dcb_service
          !!(fcoe_vlan&.dcb_service)
        end

        def auto_vlan
          !!(fcoe_vlan&.auto_vlan)
        end

        # Sets a new value for the dcb_service attribute
        #
        # @param value [String]
        def dcb_service=(value)
          # YaST somehow validates dcb_required in the form. A warning pop-up is displayed as soon
          # as the selector is set to "yes" if the card is not DCB capable. That happens before
          # clicking on "next", but the user can ignore it and store the "wrong" value.
          #
          # For the time being, let's do something similar - control the case at UI level and allow
          # any value at D-Bus level. We may reconsider that in the future and do something like:
          # raise ::DBus::Error, "Invalid dcb_required" unless valid_dcb_required?(value)

          fcoe_manager.update_fcoe_vlan(interface, :dcb_service, value)
        end

        # Sets a new value for the fcoe_service attribute
        #
        # @param value [String]
        def fcoe_service=(value)
          fcoe_manager.update_fcoe_vlan(interface, :fcoe_service, value)
        end

        # Sets a new value for the auto_vlan attribute
        #
        # @param value [String]
        def auto_vlan=(value)
          fcoe_manager.update_fcoe_vlan(interface, :auto_vlan, value)
        end

        # Sets the associated interface
        #
        # @note A properties changed signal is always emitted.
        #
        # @param value [Agama::Storage::Fcoe::Interface]
        def interface=(value)
          @interface = value

          properties = interfaces_and_properties[FCOE_IFACE_INTERFACE]
          dbus_properties_changed(FCOE_IFACE_INTERFACE, properties, [])
        end

        # @return [Integer] 0 on success, 1 if creating an FCoE VLAN is not supported on that
        #   interface, 2 if creating the VLAN makes no sense in the current context (eg. there is
        #   already a FCoE VLAN for another VLAN of this interface), 3 if any of the steps of
        #   the operation failed
        def create_fcoe_vlan
          result = fcoe_manager.create_fcoe_vlan(interface)
          return unless result.zero?

          self.interface = interface
        end

        FCOE_IFACE_INTERFACE = "org.opensuse.Agama.Storage1.FCOE.Interface"
        private_constant :FCOE_IFACE_INTERFACE

        dbus_interface FCOE_IFACE_INTERFACE do
          dbus_reader(:parent_device, "s") # eth1
          dbus_reader(:vlan_id, "s") # "500", "0" if no VLAN is used
          dbus_reader(:model, "s") 
          dbus_reader(:driver, "s") 
          dbus_reader(:dcb_capable, "b") 
          # FCoE VLAN
          dbus_reader(:fcoe_vlan_possible, "b")
          dbus_reader(:fcoe_vlan_device, "s") # "eth1.500-fcoe" or ""
          # Configuration of the FCoE VLAN
          dbus_accessor(:fcoe_service, "b")
          dbus_accessor(:dcb_service, "b")
          dbus_accessor(:auto_vlan, "b")
          # Management of the FCoE VLAN
          dbus_method(:CreateFcoeVlan, "out result:u") { create_fcoe_vlan }
          dbus_method(:RemoveFcoeVlan, "out result:u") { remove_fcoe_vlan }
        end
      end
    end
  end
end
