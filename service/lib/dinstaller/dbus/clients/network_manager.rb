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
require "dinstaller/network/connection"
require "dinstaller/network/ipv4"
require "ipaddr"

module DInstaller
  module DBus
    module Clients
      # Implements a simple network manager which just exposes the part of the D-Bus
      # interface that it is needed by D-Installer
      #
      # @example Register a callback to run when a new active connection appears
      #   client = NetworkManager.new
      #   client.on_connection_added do |conn|
      #     puts "New connection: {conn.id}"
      #   end
      class NetworkManager
        NM_SERVICE = "org.freedesktop.NetworkManager"
        private_constant :NM_SERVICE

        # @param logger [Logger]
        def initialize(logger)
          @logger = logger
          @bus = ::DBus::SystemBus.instance
          @service = @bus.service(NM_SERVICE)
          @callbacks = {}
          @active_connections_ids = {}
          register_handlers
        end

        # Returns the list of active connections
        #
        # @return [Array<ActiveConnection>]
        def active_connections
          active_connections_paths.map do |path|
            conn = find_active_connection(path)
            @active_connections_ids[path] = conn.id
            conn
          end
        end

        # Returns the list of connections (settings)
        #
        # @return [Array<Connection>]
        def connections
          connections_paths.each do |path|
            find_connection_by_path(path)
          end
        end

        # Returns the connection with the given ID
        #
        # @param [String] Connection ID
        # @return [Connection,nil] The connection or nil if no
        #   connection with the given id is found
        def find_connection(id)
          path = settings_object.GetConnectionByUuid(id).first
          find_connection_by_path(path)
        end

        # Updates the connection
        #
        # @param conn [Connection] Connection to update
        # @return [Boolean] true if the connection was updated; false otherwise
        def update_connection(conn)
          # FIXME: unify with the other call to GetConnectionByUuid
          settings_path = settings_object.GetConnectionByUuid(conn.id).first
          settings_obj = service.object(settings_path)
          settings = settings_obj.GetSettings.first
          clean_deprecated_settings(settings)
          merge_connection(settings, conn)
          adjust_dbus_types(settings)
          settings_obj.Update(settings)
          activate_connection(settings_path)
          true
        rescue ::DBus::Error => e
          logger.error e.inspect.to_s
          false
        end

        # Activates the connection in the given path
        #
        # @param path [String]
        def activate_connection(path)
          nm_object.ActivateConnection(path, "/", "/")
        end

        ACTIVE_CONNECTION_ADDED = "active_connection_added"
        private_constant :ACTIVE_CONNECTION_ADDED

        # Adds a callback to run when an active connection is added
        #
        # @param block [Proc] a block that receives a Connection
        #   instance when a new active connection appears
        def on_active_connection_added(&block)
          add_callback(ACTIVE_CONNECTION_ADDED, &block)
        end

        ACTIVE_CONNECTION_UPDATED = "active_connection_updated"
        private_constant :ACTIVE_CONNECTION_UPDATED

        # Adds a callback to run when an active connection changes
        #
        # @param block [Proc] a block that receives a Connection
        #   instance when an active connection changes
        def on_active_connection_updated(&block)
          add_callback(ACTIVE_CONNECTION_UPDATED, &block)
        end

        ACTIVE_CONNECTION_REMOVED = "active_connection_removed"
        private_constant :ACTIVE_CONNECTION_REMOVED

        # Adds a callback to run when an active connection is removed
        #
        # @param block [Proc] a block that receives a Connection ID
        #   when an active connection is removed
        def on_active_connection_removed(&block)
          add_callback(ACTIVE_CONNECTION_REMOVED, &block)
        end

      private

        # System D-Bus
        #
        # @return [::DBus::Connection]
        attr_reader :bus

        attr_reader :service

        # @return [Logger]
        attr_reader :logger

        TYPES_MAP = {
          "connection.permissions"                => "as",
          "802-3-ethernet.mac-address"            => "ay",
          "802-3-ethernet.mac-address-blacklist"  => "as",
          "802-3-ethernet.s390-options"           => "a{ss}",
          "802-11-wireless.mac-address"           => "ay",
          "802-11-wireless.mac-address-blacklist" => "as",
          "802-11-wireless.ssid"                  => "ay",
          "ipv4.address-data"                     => "aa{sv}",
          "ipv4.addresses"                        => "aau",
          "ipv4.dns"                              => "au",
          "ipv4.dns-search"                       => "as",
          "ipv4.route-data"                       => "aa{sv}",
          "ipv4.routes"                           => "aau",
          "ipv6.address-data"                     => "aa{sv}",
          "ipv6.dns"                              => "aay",
          "ipv6.dns-search"                       => "as",
          "ipv6.route-data"                       => "aa{sv}",
          "ipv6.routes"                           => "a(ayuayu)"
        }.freeze

        # Adjusts settings D-Bus types
        #
        # @param settings [ProxyObject] Connection settings object
        def adjust_dbus_types(settings)
          TYPES_MAP.each do |dot_prop, type|
            section, prop = dot_prop.split "."
            next if settings.dig(section, prop).nil?

            settings[section][prop] = ::DBus::Data.make_typed(type, settings[section][prop])
          end
        end

        NM_PATH = "/org/freedesktop/NetworkManager"
        private_constant :NM_PATH

        # Main NetworkManager D-Bus object
        #
        # @return [::DBus::ProxyObject]
        def nm_object
          @nm_object ||= @service.object(NM_PATH)
        end

        NM_SETTINGS_PATH = "/org/freedesktop/NetworkManager/Settings"
        private_constant :NM_SETTINGS_PATH

        # NetworkManager settings D-Bus object
        #
        # @return [::DBus::ProxyObject]
        def settings_object
          @settings_object ||= @service.object(NM_SETTINGS_PATH)
        end

        NM_IFACE = "org.freedesktop.NetworkManager"
        private_constant :NM_IFACE

        # List of active connections D-Bus paths
        #
        # @return [Array<String>]
        def active_connections_paths
          nm_object[NM_IFACE]["ActiveConnections"]
        end

        NM_SETTINGS_IFACE = "org.freedesktop.NetworkManager.Settings"
        private_constant :NM_SETTINGS_IFACE

        # List of connections D-Bus paths
        #
        # @return [Array<String>]
        def connections_paths
          settings_object[NM_SETTINGS_IFACE].ListConnections.first
        end

        NM_ACTIVE_CONNECTION_IFACE = "org.freedesktop.NetworkManager.Connection.Active"
        private_constant :NM_ACTIVE_CONNECTION_IFACE

        # Returns an active connection object from the given path
        #
        # @param path [String] Connection path
        # @return [ActiveConnection,nil] ActiveConnection instance or nil if it does not exist
        def find_active_connection(path)
          obj = service.object(path)
          conn = obj[NM_ACTIVE_CONNECTION_IFACE]

          ip4_obj = service.object(conn["Ip4Config"])
          ip4_config = ip4_obj["org.freedesktop.NetworkManager.IP4Config"]

          type = DInstaller::Network::ConnectionType.by_id(conn["Type"])
          state = DInstaller::Network::ConnectionState.by_id(conn["State"])
          DInstaller::Network::ActiveConnection.new(
            conn["Uuid"], conn["Id"], type: type, state: state, addresses: ip4_config["AddressData"]
          )
        rescue ::DBus::Error
          nil
        end

        NM_SETTINGS_CONNECTION_IFACE = "org.freedesktop.NetworkManager.Settings.Connection"
        private_constant :NM_SETTINGS_IFACE

        # Returns an active connection object from the given path
        #
        # @return [Connection,nil] Connection instance or nil if it does not exist
        def find_connection_by_path(path)
          obj = service.object(path)
          conn = obj[NM_SETTINGS_CONNECTION_IFACE]
          settings = conn.GetSettings.first
          ipv4_hsh = settings.fetch("ipv4", {})
          ipv4 = DInstaller::Network::IPv4.new(
            meth:        DInstaller::Network::ConnectionMethod.by_id(ipv4_hsh["method"]),
            addresses:   ipv4_hsh["address-data"],
            gateway:     ipv4_hsh["gateway"] && IPAddr.new(settings["ipv4"]["gateway"]),
            nameservers: ipv4_hsh.fetch("dns", []).map { |i| IPAddr.new(i, Socket::AF_INET) }
          )

          logger.info "settings for connection: #{settings.inspect}"
          DInstaller::Network::Connection.new(
            settings["connection"]["uuid"],
            settings["connection"]["id"],
            ipv4: ipv4
          )
        rescue ::DBus::Error
          nil
        end

        # Registers D-Bus signal handlers
        #
        # Listens for active connections changes
        def register_handlers
          mr = ::DBus::MatchRule.new.from_s(
            "type='signal'," \
            "interface='org.freedesktop.NetworkManager.Connection.Active'," \
            "member='StateChanged'"
          )

          bus.add_match(mr) do |msg|
            conn = find_active_connection(msg.path)
            if conn.nil?
              conn_id = @active_connections_ids.delete(msg.path)
              run_callbacks(ACTIVE_CONNECTION_REMOVED, conn_id) unless conn_id.nil?
            else
              callback_type = if @active_connections_ids.key?(msg.path)
                ACTIVE_CONNECTION_UPDATED
              else
                ACTIVE_CONNECTION_ADDED
              end
              @active_connections_ids[msg.path] = conn.id
              run_callbacks(callback_type, conn)
            end
          end
        end

        DEPRECATED_KEYS = [
          "ipv4.gateway", "ipv4.addresses", "ipv4.routes",
          "ipv6.gateway", "ipv6.addresses", "ipv6.routes"
        ].freeze

        # Cleans deprecated keys
        def clean_deprecated_settings(settings)
          DEPRECATED_KEYS.each do |dot_prop|
            section, key = dot_prop.split "."
            settings[section]&.delete(key)
          end
        end

        # Merges the connection into the D-Bus settings object
        #
        # @param settings [ProxyObject]
        # @param conn [Connection]
        def merge_connection(settings, conn)
          settings["ipv4"]["address-data"] = conn.ipv4.addresses.map do |a|
            { "prefix" => ::DBus::Data.make_typed("u", a[:prefix]), "address" => a[:address] }
          end

          gateway = conn.ipv4.gateway.to_s
          settings["ipv4"].delete("gateway")
          settings["ipv4"]["gateway"] = gateway if gateway.empty?
          settings["ipv4"]["dns"] = conn.ipv4.nameservers.map(&:to_i)
          settings["ipv4"]["method"] = conn.ipv4.meth.id
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
