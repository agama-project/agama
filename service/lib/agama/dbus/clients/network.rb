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

require "agama/dbus/clients/base"

module Agama
  module DBus
    module Clients
      # D-Bus client for the network service
      #
      # This client is intended to be used to watch for changes in
      # NetworkManager because Agama does not implement its own network
      # service. The configuration is done directly in the UI or through
      # `nmcli`.
      class Network < Base
        def initialize
          super

          @dbus_object = service["/org/freedesktop/NetworkManager"]
          @dbus_object.introspect
          @nm_iface = @dbus_object["org.freedesktop.NetworkManager"]
        end

        def service_name
          @service_name ||= "org.freedesktop.NetworkManager"
        end

        CONNECTED_NM_STATE = 70
        private_constant :CONNECTED_NM_STATE

        # Registers a callback to call when connectivity state changes
        #
        # The block receives a boolean argument which is true when the network
        # connection is working or false otherwise.
        #
        # @param [Proc] block
        def on_connection_changed(&block)
          @nm_iface.on_signal("StateChanged") do |nm_state|
            block.call(nm_state == CONNECTED_NM_STATE)
          end
        end

      private

        def bus
          @bus ||= ::DBus::SystemBus.instance
        end
      end
    end
  end
end
