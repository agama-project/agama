# Copyright (c) [2021] SUSE LLC
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

module Yast2
  class DBusClient
    SERVICE_NAME = "org.opensuse.YaST"
    OBJECT_PATH = "/org/opensuse/YaST/Installer"
    IFACE = "org.opensuse.YaST.Installer"
    PROPERTIES_IFACE = "org.freedesktop.DBus.Properties"

    class CouldNotSetProperty < StandardError; end

    attr_reader :bus

    # Constructor
    def initialize
      @bus = DBus::SystemBus.instance
    end

    # Returns the installer properties
    #
    # @return [Array<Hash<String,Object>>] Returns the installer properties
    def get_properties
      installer_obj[PROPERTIES_IFACE].GetAll(IFACE)
    end

    # Returns a property value
    #
    # @param name [String] Property name
    # @return [Object] Property value
    def get_property(name)
      installer_obj[PROPERTIES_IFACE].Get(IFACE, name)
    end

    # Sets a property value
    #
    # @param name [String] Property name
    # @param value [String] Property value
    # @raise CouldNotSetProperty
    def set_property(name, value)
      installer_obj[PROPERTIES_IFACE].Set(IFACE, name, value)
    rescue DBus::Error => e
      raise CouldNotSetProperty, e.stderr
    end

    # Calls a method from the installer D-Bus interface
    #
    # @param meth [String] Method name
    # @param args [Array<String>] Method arguments
    def call(meth, args = [])
      installer_obj.send(meth, *args)
    end

    # Runs a block when a relevant property changes
    #
    # @param block [Proc] Block to run
    def on_property_change(&block)
      service = bus.service(SERVICE_NAME)
      installer_obj = service.object(OBJECT_PATH)
      installer_obj[PROPERTIES_IFACE].on_signal("PropertiesChanged") do |iface, changes|
        return unless iface == IFACE

        block.call(changes)
      end
    end

    # Runs a block when the status changes
    #
    # @param block [Proc] Block to run
    def on_status_change(&block)
      installer_obj[IFACE].on_signal("StatusChanged") do |status|
        block.call(status)
      end
    end

    # Dispatch the message queue in a non-blocking fashion
    #
    # This method runs any callback defined using the #on_property_change for
    # each change.
    #
    # @see #on_property_change
    # @see #on_status_change
    def dispatch
      bus.dispatch_message_queue
    end

  private

    def installer_obj
      return @installer_obj if @installer_obj

      bus = DBus::SystemBus.instance
      service = bus.service(SERVICE_NAME)
      @installer_obj = service.object(OBJECT_PATH)
      @installer_obj.default_iface = IFACE
      @installer_obj
    end
  end
end
