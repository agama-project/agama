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

    def get_properties
      dbus_object[PROPERTIES_IFACE].GetAll(IFACE)
    end

    def get_property(name)
      dbus_object[PROPERTIES_IFACE].Get(IFACE, name)
    end

    def set_property(name, value)
      dbus_object[PROPERTIES_IFACE].Set(IFACE, name, value)
    end

    def call(meth, args = [])
      dbus_object.send(meth, *args)
    end

  private

    def dbus_object
      return @dbus_obj if @dbus_obj

      bus = ::DBus::SystemBus.instance
      service = bus.service(SERVICE_NAME)
      @dbus_obj = service.object(OBJECT_PATH)
      @dbus_obj.default_iface = IFACE
      @dbus_obj
    end
  end
end
