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

require "dinstaller/network/connection_type"
require "dinstaller/network/connection_state"

module DInstaller
  module Network
    # Represents an active network connection
    #
    # It contains just the relevant parts for D-Installer.
    class ActiveConnection
      # @return [String] Connection ID (e.g., an UUID)
      attr_reader :id

      # @return [String] Connection name (e.g., "Wired connection")
      attr_reader :name

      # @return [ConnectionType] Connection type
      attr_reader :type

      # @return [ConnectionState] Connection state
      attr_reader :state

      # @return [Array<Hash>] Assigned addresses
      attr_reader :addresses

      def initialize(id, name, type: nil, state: nil, addresses: [])
        @id = id
        @name = name
        @type = type || ConnectionType::ETHERNET
        @state = state || ConnectionState::UNKNOWN
        @addresses = addresses
      end

      # Determines whether two connection objects are equivalent
      #
      # @param other [Connection] Object to compare with
      def ==(other)
        id == other.id && name == other.name && type == other.type && state == other.state
      end

      # Returns a hash representation to be used in D-Bus
      #
      # @return [Hash]
      def to_dbus
        {
          "id"        => id,
          "name"      => name,
          "type"      => type.id,
          "state"     => state.id,
          "addresses" => addresses
        }
      end
    end
  end
end
