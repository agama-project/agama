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
require "dinstaller/network/active_connection"
require "dinstaller/network/ip_config"

module DInstaller
  module DBus
    module Clients
      # Implements a simple network manager which just exposes the part of the D-Bus
      # interface that it is needed by D-Installer
      class NetworkManager
        NM_SERVICE = "org.freedesktop.NetworkManager".freeze
        private_constant :NM_SERVICE

        NM_IFACE = "org.freedesktop.NetworkManager".freeze
        private_constant :NM_IFACE

        NM_PATH = "/org/freedesktop/NetworkManager".freeze
        private_constant :NM_PATH

        NM_ACTIVE_CONNECTION_IFACE = "org.freedesktop.NetworkManager.Connection.Active".freeze
        private_constant :NM_ACTIVE_CONNECTION_IFACE

        NM_SETTINGS_CONNECTION = "org.freedesktop.NetworkManager.Settings.Connection"
        private_constant :NM_SETTINGS_CONNECTION

        CONNECTION_ADDED = "connection_added".freeze
        CONNECTION_UPDATED = "connection_updated".freeze
        CONNECTION_REMOVED = "connection_removed".freeze

        def initialize
          @bus = ::DBus::SystemBus.instance
          @service = @bus.service(NM_SERVICE)
          @callbacks = {}
          cache_active_connections
          register_handlers
        end

        def active_connections
          @active_connections.values
        end

        def on_connection_added(&block)
          add_callback(CONNECTION_ADDED, &block)
        end

        def on_connection_updated(&block)
          add_callback(CONNECTION_UPDATED, &block)
        end

        def on_connection_removed(&block)
          add_callback(CONNECTION_REMOVED, &block)
        end

      private

        # System D-Bus
        #
        # @return [::DBus::Connection]
        attr_reader :bus

        attr_reader :service

        def nm_object
          @nm_object ||= @service.object(NM_PATH)
        end

        def active_connections_paths
          nm_object[NM_IFACE]["ActiveConnections"]
        end

        # Returns an active connection object from the given path
        #
        # @param path [String] Connection path
        # @return [Connection]
        def find_active_connection(path)
          obj = service.object(path)
          conn = obj[NM_ACTIVE_CONNECTION_IFACE]

          ip4_obj = service.object(conn["Ip4Config"])
          ip4_config = ip4_obj["org.freedesktop.NetworkManager.IP4Config"]
          
          DInstaller::Network::ActiveConnection.new(
            conn["Id"], conn["Type"], conn["State"], ip4_config["AddressData"], ip4_config["Gateway"]
          )
        rescue ::DBus::Error
          nil
        end

        def cache_active_connections
          @active_connections ||= active_connections_paths.each_with_object({}) do |path, conns|
            conns[path] = find_active_connection(path)
          end
        end

        # Registers D-Bus signal handlers
        def register_handlers
          mr = ::DBus::MatchRule.new.from_s "type='signal',interface='org.freedesktop.NetworkManager.Connection.Active',member='StateChanged'"
          bus.add_match(mr) do |msg|
            conn = find_active_connection(msg.path)
            if conn.nil?
              old_conn = @active_connections.delete(msg.path)
              run_callbacks(CONNECTION_REMOVED, old_conn) unless old_conn.nil?
            else
              callback_type = @active_connections.key?(msg.path) ? CONNECTION_UPDATED : CONNECTION_ADDED
              @active_connections[msg.path] = conn
              run_callbacks(callback_type, conn)
            end
          end
        end

        # Adds a callback for the given event type
        #
        # @param type [String] Event type
        # @param block [Proc] Callback to call in the given event
        def add_callback(type, &block)
          @callbacks[type] = []
          @callbacks[type] << block
        end

        # Runs the callback for the given even type
        #
        # @param type [String] Event type
        # @param *args [Array<Object>] Arguments for the callback
        def run_callbacks(type, *args)
          return unless @callbacks[type]

          @callbacks[type].each { |cb| cb.call(*args) }
        end
      end
    end
  end
end
