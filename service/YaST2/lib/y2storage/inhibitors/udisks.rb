# Copyright (c) 2018 SUSE LLC
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

module Y2Storage
  # class to inhibit udisks from doing mounts
  class Udisks
    include Yast::Logger

    @dbus_cookie = nil

    def inhibit
      log.info "inhibit udisks"
      begin
        @dbus_cookie = dbus_object.Inhibit().first
      rescue Errno::ENOENT, DBus::Error => e
        log.error "inhibit udisks failed #{e.message}"
      end
    end

    def uninhibit
      return if !@dbus_cookie

      log.info "uninhibit udisks"
      begin
        dbus_object.Uninhibit(@dbus_cookie)
        @dbus_cookie = nil
      rescue Errno::ENOENT, DBus::Error => e
        log.error "uninhibit udisks failed #{e.message}"
      end
    end

    private

    def dbus_object
      system_bus = DBus::SystemBus.instance
      service = system_bus.service("org.freedesktop.UDisks")
      dbus_object = service.object("/org/freedesktop/UDisks")
      dbus_object.default_iface = "org.freedesktop.UDisks"
      dbus_object
    end
  end
end
