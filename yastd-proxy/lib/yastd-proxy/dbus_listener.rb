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
  # Listens for changes in the /org/opensuse/YaST/Installer object
  class DBusListener
    SERVICE_NAME = "org.opensuse.YaST"
    OBJECT_PATH = "/org/opensuse/YaST/Installer"
    IFACE = "org.opensuse.YaST.Installer"
    PROPERTIES_IFACE = "org.freedesktop.DBus.Properties"

    attr_reader :bus

    # Constructor
    def initialize
      @bus = DBus::SystemBus.instance
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

    # Dispatch the message queue in a non-blocking fashion
    #
    # This method runs any callback defined using the #on_property_change for
    # each change.
    #
    # @see #on_property_change
    def dispatch
      bus.dispatch_message_queue
    end
  end
end
