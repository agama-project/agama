# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

require "dinstaller/dbus/clients/base"

module DInstaller
  module DBus
    module Clients
      # D-Bus client for the network service
      #
      # It is based on NetworkManager
      class Network < Base
        def initialize
          super

          @dbus_object = service.object("/org/freedesktop/NetworkManager")
          @dbus_object.introspect
          @nm_iface = @dbus_object["org.freedesktop.NetworkManager"]
        end

        def service_name
          @service_name ||= "org.freedesktop.NetworkManager"
        end

        def on_connection_changed(&block)
          @nm_iface.on_signal("StateChanged") do |s|
            block.call if s == 70
          end
        end

      private

        def bus
          @bus ||= DBus::SystemBus.instance
        end
      end
    end
  end
end
