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

require "dbus"
require "agama/dbus/server_manager"

module Agama
  module DBus
    # Represents the Agama bus, a distinct one from the system and session buses.
    class Bus < ::DBus::BusConnection
      class << self
        # Returns the current D-Bus connection
        #
        # @return [Bus] D-Bus connection
        def current
          return @current if @current

          dbus_manager = ServerManager.new
          dbus_manager.find_or_start_server
          @current = new(dbus_manager.address)
        end

        def reset
          @current = nil
        end
      end

      # @param address [String] a connectable address
      # @see https://dbus.freedesktop.org/doc/dbus-specification.html#addresses
      def initialize(address)
        super(address)
        send_hello
      end
    end
  end
end
