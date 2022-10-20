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
require "dinstaller/dbus/base_object"

module DInstaller
  module DBus
    class Network < BaseObject
      PATH = "/org/opensuse/DInstaller/Network1"
      private_constant :PATH

      # Constructor
      #
      # @param backend [DInstaller::Network]
      # @param logger [Logger]
      def initialize(backend, logger)
        super(PATH, logger: logger)
        @backend = backend
      end

      NETWORK_INTERFACE = "org.opensuse.DInstaller.Network1"
      private_constant :NETWORK_INTERFACE

      dbus_interface NETWORK_INTERFACE do
        dbus_reader :active_connections, "aa{sv}"
      end

      # Returns the list of active connections
      #
      # @return [Array<Hash>]
      def active_connections
        @backend.active_connections.map do |conn|
          conn.to_dbus
        end
      end
    end
  end
end
