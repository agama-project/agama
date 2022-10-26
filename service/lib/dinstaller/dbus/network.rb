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
require "dinstaller/network/connection"

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
        register_callbacks
      end

      NETWORK_INTERFACE = "org.opensuse.DInstaller.Network1"
      private_constant :NETWORK_INTERFACE

      dbus_interface NETWORK_INTERFACE do
        dbus_reader :active_connections, "aa{sv}"
        dbus_reader :connections, "aa{sv}"
        dbus_method :GetConnection, "in Id:s, out Result:a{sv}" do |id|
          conn = backend.find_connection(id)
          [conn.to_dbus]
        end
        dbus_method :UpdateConnection, "in data:a{sv}, out result:u" do |data|
          conn = DInstaller::Network::Connection.from_dbus(data)
          result = backend.update_connection(conn)
          result ? 0 : 1
        end
        dbus_signal(:ConnectionAdded, "conn:a{sv}")
        dbus_signal(:ConnectionUpdated, "conn:a{sv}")
        dbus_signal(:ConnectionRemoved, "id:s")
      end

      # Returns the list of active connections
      #
      # @return [Array<Hash>]
      def active_connections
        backend.active_connections.map(&:to_dbus)
      end

      # Returns the list of connections
      #
      # @return [Array<Hash>]
      def connections
        backend.connections.map(&:to_dbus)
      end

    private

      # @return [DInstaller::Software]
      attr_reader :backend

      def register_callbacks
        backend.on_active_connection_added do |conn|
          ConnectionAdded(conn.to_dbus)
        end

        backend.on_active_connection_updated do |conn|
          ConnectionUpdated(conn.to_dbus)
        end

        backend.on_active_connection_removed do |id|
          ConnectionRemoved(id)
        end
      end
    end
  end
end
