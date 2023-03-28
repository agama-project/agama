# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
require "agama/dbus/base_object"
require "agama/dbus/storage/with_iscsi_auth"

module Agama
  module DBus
    module Storage
      # Class representing an iSCSI node
      class ISCSINode < BaseObject
        include WithISCSIAuth

        # @return [Agama::Storage::ISCSI::Manager]
        attr_reader :iscsi_manager

        # @return [Agama::Storage::ISCSI::Node]
        attr_reader :iscsi_node

        # Constructor
        #
        # @param iscsi_manager [Agama::Storage::Iscsi::Manager]
        # @param iscsi_node [Agama::Storage::Iscsi::Node]
        # @param path [DBus::ObjectPath] Path in which the object is exported
        # @param logger [Logger, nil]
        def initialize(iscsi_manager, iscsi_node, path, logger: nil)
          super(path, logger: logger)

          @iscsi_manager = iscsi_manager
          @iscsi_node = iscsi_node
        end

        # Name of the iSCSI target
        #
        # @return [String]
        def target
          iscsi_node.target || ""
        end

        # IP address of the iSCSI target
        #
        # @return [String]
        def address
          iscsi_node.address || ""
        end

        # Port of the iSCSI target
        #
        # @return [Integer]
        def port
          iscsi_node.port || 0
        end

        # Interface of the iSCSI node
        #
        # @return [String]
        def interface
          iscsi_node.interface || ""
        end

        # Whether the iSCSI node was initiated by iBTF
        #
        # @return [Boolean]
        def ibft
          iscsi_node.ibft?
        end

        # Whether the node is connected
        #
        # @return [Boolean]
        def connected
          iscsi_node.connected?
        end

        # Startup status of the connection
        #
        # @return [String] Empty if the node is not connected
        def startup
          iscsi_node.startup || ""
        end

        # Sets a new value for the startup status
        #
        # @raise [::DBus::Error] If the given value is not valid.
        #
        # @param value [String]
        def startup=(value)
          raise ::DBus::Error, "Invalid startup value: #{value}" unless valid_startup?(value)

          iscsi_manager.update(iscsi_node, startup: value)
        end

        # Sets the associated iSCSI node
        #
        # @note A properties changed signal is always emitted.
        #
        # @param value [Agama::Storage::ISCSI::Node]
        def iscsi_node=(value)
          @iscsi_node = value

          properties = interfaces_and_properties[ISCSI_NODE_INTERFACE]
          dbus_properties_changed(ISCSI_NODE_INTERFACE, properties, [])
        end

        # Creates an iSCSI session
        #
        # @param options [Hash<String, String>] Options from a D-Bus call:
        #   @option Username [String] Username for authentication by target
        #   @option Password [String] Password for authentication by target
        #   @option ReverseUsername [String] Username for authentication by initiator
        #   @option ReversePassword [String] Password for authentication by inititator
        #   @option Startup [String] Valid values are "onboot", "manual", "automatic"
        #
        # @return [Integer] 0 on success, 1 on failure if the given startup value is not valid, and
        #   2 on failure because any other reason.
        def login(options = {})
          auth = iscsi_auth(options)
          startup = options["Startup"]

          if startup && !valid_startup?(startup)
            logger.info("iSCSI login error: startup value #{startup} is not valid")
            return 1
          end

          success = iscsi_manager.login(iscsi_node, auth, startup: startup)
          return 0 if success

          logger.info("iSCSI login error: fail to login iSCSI node #{path}")
          2 # Error code
        end

        # Logouts the iSCSI session
        #
        # @return [Integer] 0 on success, 1 on failure
        def logout
          success = iscsi_manager.logout(iscsi_node)
          success ? 0 : 1
        end

        ISCSI_NODE_INTERFACE = "org.opensuse.Agama.Storage1.ISCSI.Node"
        private_constant :ISCSI_NODE_INTERFACE

        dbus_interface ISCSI_NODE_INTERFACE do
          dbus_reader(:target, "s")
          dbus_reader(:address, "s")
          dbus_reader(:port, "u")
          dbus_reader(:interface, "s")
          dbus_reader(:ibft, "b", dbus_name: "IBFT")
          dbus_reader(:connected, "b")
          dbus_accessor(:startup, "s")
          dbus_method(:Login, "in options:a{sv}, out result:u") { |o| login(o) }
          dbus_method(:Logout, "out result:u") { logout }
        end

      private

        # Whether the given value is a valid startup status
        #
        # @param value [String]
        # @return [Boolean]
        def valid_startup?(value)
          Agama::Storage::ISCSI::Manager::STARTUP_OPTIONS.include?(value)
        end
      end
    end
  end
end
