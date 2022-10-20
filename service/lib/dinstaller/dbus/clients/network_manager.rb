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
require "dinstaller/network/connection"
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

        def initialize
          @bus = ::DBus::SystemBus.instance
          @service = @bus.service(NM_SERVICE)
        end

        def active_connections
          nm_object[NM_IFACE]["ActiveConnections"].map do |path|
            find_active_connection(path)
          end
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

        # Returns an active connection object from the given path
        #
        # @param path [String] Connection path
        # @return [Connection]
        def find_active_connection(path)
          obj = service.object(path)
          conn = obj[NM_ACTIVE_CONNECTION_IFACE]
          ip4_config = find_ip4_config(conn["Connection"])
          
          DInstaller::Network::Connection.new(
            conn["Id"], path, conn["Type"], conn["State"], ip4_config
          )
        end

        # Returns the IP configuration from a given path
        #
        # @param path [String] IP configuration path
        # @return [IPConfig]
        def find_ip4_config(path)
          obj = service.object(path)
          settings = obj[NM_SETTINGS_CONNECTION].GetSettings.first

          ip4_config = DInstaller::Network::IPConfig.new(
            settings["ipv4"]["method"],
            settings["ipv4"]["address-data"],
            settings["ipv4"]["gateway"]
          )
        end
      end
    end
  end
end
