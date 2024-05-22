#!/usr/bin/env ruby
# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require "yast"
require "y2network/boot_protocol"
require "y2network/ip_address"
require "agama/autoyast/bond_reader"
require "agama/autoyast/wireless_reader"
require "ipaddr"

# :nodoc:
module Agama
  module AutoYaST
    # Extracts the network information from an AutoYaST profile.
    class ConnectionsReader
      # @param section [Y2Network::AutoinstProfile::Interfaces]
      def initialize(section, ipv6: false)
        @section = section
        @ipv6 = ipv6
      end

      # Converts an AutoYaST interfaces into Agama network connections.
      #
      # @return [Hash] Agama "user" section
      def read
        interfaces = section.interfaces
        return {} if interfaces.empty?

        connections = interfaces.map { |i| read_connection(i) }
        { "connections" => connections }
      end

    private

      attr_reader :section

      def ipv6?
        @ipv6
      end

      # Reads an AutoYaST interface entry and builds its corresponding connection.
      #
      # @return [Y2Network::AutoinstProfile::InterfaceSection]
      def read_connection(interface)
        conn = {}
        conn["device"] = interface.device if interface.device
        conn["id"] = interface.name if interface.name

        addresses = read_addresses(interface)
        method4, method6 = read_methods(interface)
        conn["method4"] = method4
        conn["method6"] = method6
        conn["addresses"] = addresses
        wireless = Agama::AutoYaST::WirelessReader.new(interface).read
        conn["wireless"] = wireless unless wireless.empty?
        bond = Agama::AutoYaST::BondReader.new(interface).read
        conn["bond"] = bond unless bond.empty?

        conn
      end

      # @param networking [Y2Network::AutoinstProfile::NetworkingSection]
      # @return [Array<Hash>]
      def read_addresses(interface)
        addresses = []
        if !interface.ipaddr.to_s.empty?
          primary = ipaddress_from(interface.ipaddr, interface.prefixlen, interface.netmask)
          addresses.push(primary) if primary
        end

        secondary = interface.aliases.map { |a| ipaddress_from(a.ipaddr, a.prefixlen, a.netmask) }
        addresses.concat(secondary)
      end

      # @return [IPAddress]
      def ipaddress_from(address, prefix, netmask)
        ipaddr = Y2Network::IPAddress.from_string(address)

        # Assign first netmask, as prefix has precedence so it will overwrite it
        ipaddr.prefix = prefix_for(netmask) if !netmask.to_s.empty?
        ipaddr.prefix = prefix_for(prefix) if !prefix.to_s.empty?

        ipaddr
      rescue IPAddr::InvalidAddressError, IPAddr::AddressFamilyError
        nil
      end

      # @param interface [Y2Network::AutoinstProfile::InterfaceSection]
      # @return [String, String] method4 and method6 values
      def read_methods(interface)
        bootproto = Y2Network::BootProtocol.from_name(interface.bootproto)
        case bootproto
        when Y2Network::BootProtocol::DHCP4
          ["auto", "disabled"]
        when Y2Network::BootProtocol::DHCP6
          ["disabled", "auto"]
        when Y2Network::BootProtocol::STATIC
          ["manual", ipv6? ? "manual" : "disabled"]
        when Y2Network::BootProtocol::NONE
          ["disabled", "disabled"]
        else
          ["auto", ipv6? ? "auto" : "disabled"]
        end
      end

      # Converts a given IP Address netmask or prefix length in different
      # formats to its prefix length value.
      #
      # @param value [String] IP Address prefix length or netmask in its different formats
      # @return [Integer,nil] the given value in IP Address prefix length
      #   format
      # Taken from Y2Network::Autoinst::InterfacesReader
      def prefix_for(value)
        if value.empty?
          nil
        elsif value.start_with?("/")
          value[1..-1].to_i
        elsif value =~ /^\d{1,3}$/
          value.to_i
        else
          IPAddr.new("#{value}/#{value}").prefix
        end
      end
    end
  end
end
