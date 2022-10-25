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

module DInstaller
  module Network
    # Represents the configuration (profile) for a network connection
    class Connection
      # @return [String] Connection ID (e.g., an UUID)
      attr_reader :id

      # @return [String] Connection name (e.g., "Wired connection")
      attr_reader :name

      # @return [IPv4] IPv4 settings
      attr_reader :ipv4

      class << self
        # @param id [String] Connection ID
        # @param name [String] Connection name
        # @param ipv4 [Hash] IPv4 configuration data
        def from_dbus(data)
          new(data["id"], data["name"], ipv4: IPv4.from_dbus(data["ipv4"]))
        end
      end

      # @param id [String] Connection ID
      # @param name [String] Connection name
      # @param ipv4 [IPv4] IPv4 settings
      def initialize(id, name, ipv4: IPv4.new)
        @id = id
        @name = name
        @ipv4 = ipv4
      end

      # Returns a hash representation to be used in D-Bus
      #
      # @return [Hash]
      def to_dbus
        {
          "id"   => id,
          "name" => name,
          "ipv4" => ipv4.to_dbus
        }
      end
    end
  end
end
