# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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

require "y2network/boot_protocol"
require "y2network/ip_address"
require "y2network/startmode"
require "agama/autoyast/bond_reader"
require "agama/autoyast/bridge_reader"
require "agama/autoyast/vlan_reader"
require "agama/autoyast/wireless_reader"
require "ipaddr"

module Agama
  module AutoYaST
    # Builds the Agama "network.connections" section from an AutoYaST profile.
    class ConnectionsReader
      # Readers for the device type specific settings of a connection.
      TYPE_READERS = [
        Agama::AutoYaST::BondReader,
        Agama::AutoYaST::BridgeReader,
        Agama::AutoYaST::VlanReader,
        Agama::AutoYaST::WirelessReader
      ].freeze
      private_constant :TYPE_READERS

      # Startmodes that do not bring the connection up on their own.
      #
      # The remaining ones ("auto", "hotplug", "ifplugd" and "nfsroot") are translated to an
      # auto-connected connection, as NetworkManager has no equivalent for those distinctions.
      MANUAL_STARTMODES = ["manual", "off"].freeze
      private_constant :MANUAL_STARTMODES

      # Agama methods (method4 and method6) for the boot protocols that do not depend on whether
      # IPv6 is wanted or not.
      BOOTPROTO_METHODS = {
        Y2Network::BootProtocol::DHCP4  => ["auto", "disabled"].freeze,
        Y2Network::BootProtocol::DHCP6  => ["disabled", "auto"].freeze,
        Y2Network::BootProtocol::AUTOIP => ["link-local", "disabled"].freeze,
        Y2Network::BootProtocol::NONE   => ["disabled", "disabled"].freeze
      }.freeze
      private_constant :BOOTPROTO_METHODS

      # @param section [Y2Network::AutoinstProfile::Interfaces] AutoYaST interfaces section.
      # @param ipv6 [boolean] Whether IPv6 is wanted or not.
      # @param dns [Hash] Agama DNS settings.
      def initialize(section, ipv6: false, dns: {})
        @section = section
        @ipv6 = ipv6
        @dns = dns
      end

      # Returns a hash that contains the list of Agama connections
      #
      # @return [Hash] Agama "network.connections" section
      def read
        interfaces = section.interfaces
        return {} if interfaces.empty?

        connections = interfaces.map { |i| read_connection(i) }
        { "connections" => connections }
      end

    private

      attr_reader :section, :dns

      def ipv6?
        @ipv6
      end

      # Reads an AutoYaST interface entry and builds its corresponding connection.
      #
      # @param interface [Y2Network::AutoinstProfile::InterfaceSection] Interface section.
      # @return [Hash]
      def read_connection(interface)
        conn = {}
        if !interface.device.to_s.empty?
          conn["interface"] = interface.device
          conn["id"] = interface.device
        end
        conn["id"] = interface.name unless interface.name.to_s.empty?

        method4, method6 = read_methods(interface)
        conn["method4"] = method4
        conn["method6"] = method6
        conn["addresses"] = read_addresses(interface)
        conn["macAddress"] = interface.lladdr unless interface.lladdr.to_s.empty?
        conn.merge!(read_startmode(interface))
        conn.merge!(read_type_settings(interface))
        conn.merge!(dns)

        conn
      end

      # Converts AutoYaST's startmode to the Agama "autoconnect" and "status" settings.
      #
      # Connections that are not started automatically are also left down during the installation.
      #
      # @param interface [Y2Network::AutoinstProfile::InterfaceSection] Interface section.
      # @return [Hash]
      def read_startmode(interface)
        return {} if interface.startmode.to_s.empty?

        # It takes care of the "boot", "on" and "onboot" aliases of "auto".
        startmode = Y2Network::Startmode.create(interface.startmode)
        return {} if startmode.nil?

        return { "autoconnect" => true } unless MANUAL_STARTMODES.include?(startmode.name)

        { "autoconnect" => false, "status" => "down" }
      end

      # Reads the device type specific settings (bond, bridge, VLAN and wireless).
      #
      # Each reader returns its settings wrapped in its own key (e.g., `{ "bond" => ... }`) or
      # an empty hash when they do not apply to the given interface.
      #
      # @param interface [Y2Network::AutoinstProfile::InterfaceSection] Interface section.
      # @return [Hash]
      def read_type_settings(interface)
        TYPE_READERS.reduce({}) { |all, reader| all.merge(reader.new(interface).read) }
      end

      # Reads the addresses from an AutoYaST interface section.
      #
      # @param interface [Y2Network::AutoinstProfile::InterfaceSection] Interface section.
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

      # Converts AutoYaST's boot protocol to Agama methods (method4, method6)
      #
      # @param interface [Y2Network::AutoinstProfile::InterfaceSection]
      # @return [String, String] method4 and method6 values
      def read_methods(interface)
        bootproto = Y2Network::BootProtocol.from_name(interface.bootproto)
        methods = BOOTPROTO_METHODS[bootproto]
        return methods if methods

        # The static protocol and the remaining (DHCP based or unknown) ones also configure IPv6
        # when it is wanted.
        method = bootproto&.static? ? "manual" : "auto"
        [method, ipv6? ? method : "disabled"]
      end

      # Builds an IPAddress
      #
      # If defined, "prefix" has precedence over "netmask".
      #
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
