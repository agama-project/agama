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

require "dinstaller/network/connection_method"

module DInstaller
  module Network
    # Represents the IP configuration
    class IPv4
      # @return [ConnectionMethod] Connection method
      attr_reader :meth

      # @return [Array<Hash>] Static addresses
      attr_reader :addresses

      # @return [IPAddr,nil] Gateway address
      attr_reader :gateway

      # @return [Array<IPAddr>] Name servers addresses
      attr_reader :nameservers

      class << self
        # Builds an instance from a hash from D-Bus
        #
        # @param data [Hash] IP configuration from the D-Bus object
        def from_dbus(data)
          addresses = data.fetch("addresses", []).map { |a| a.transform_keys(&:to_sym) }
          nameservers = data.fetch("nameServers", []).map { |a| IPAddr.new(a) }
          gateway = data["gateway"].to_s.empty? ? nil : IPAddr.new(data["gateway"])
          new(
            meth:        ConnectionMethod.by_id(data["method"]),
            addresses:   addresses,
            gateway:     gateway,
            nameservers: nameservers
          )
        end
      end

      # Constructor
      #
      # @param meth [ConnectionMethod] Connection method
      # @param addresses [Array<Hash>] Static addresses (each hash)
      #   contains an :address and a :prefix
      # @param gateway [IPAddr,nil] Gateway address
      # @param nameservers [Array<IPAddr>] Name servers addresses
      def initialize(meth: nil, addresses: [], nameservers: [], gateway: nil)
        @meth = meth || ConnectionMethod::AUTO
        @addresses = addresses
        @nameservers = nameservers
        @gateway = gateway
      end

      # Determines whether two connection objects are equivalent
      #
      # @param other [IPv4] Object to compare with
      def ==(other)
        meth == other.meth && addresses == other.addresses && gateway == other.gateway
      end

      # Returns a hash representation to be used in D-Bus
      #
      # @return [Hash]
      def to_dbus
        {
          "method"      => meth.id,
          "addresses"   => addresses,
          "gateway"     => gateway.to_s,
          "nameservers" => nameservers.map(&:to_s)
        }
      end
    end
  end
end
