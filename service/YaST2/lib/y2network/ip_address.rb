# Copyright (c) [2019] SUSE LLC
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

# Vendored from yast2-network's network/src/lib/y2network/ip_address.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-network`
# RPM is no longer a runtime dependency of Agama.

require "ipaddr"
require "forwardable"
require "yast2/equatable"

module Y2Network
  # This class represents an IP address
  #
  # The IPAddr from the Ruby standard library drops the host bits according to the netmask. The
  # problem is that YaST uses a CIDR-like string, including the host bits, to set IPADDR in ifcfg-*
  # files (see man 5 ifcfg for further details).
  #
  # @see ConnectionConfig::IPConfig
  # @see https://www.rubydoc.info/stdlib/ipaddr/IPAddr
  #
  # @example ::IPAddr from the standard library behavior
  #  ip = IPAddr.new("192.168.122.1/24")
  #  ip.to_s #=> "192.168.122.0/24"
  #
  # However, what we need is to be able to keep the host part
  #
  # @example Y2Network::IPAddress behavior
  #   ip = IPAddress.new("192.168.122.1/24")
  #   ip.to_s #=> "192.168.122.1/24"
  #
  # @example IPAddress with no prefix
  #   ip = IPAddress.new("192.168.122.1")
  #   ip.to_s #=> "192.168.122.1"
  class IPAddress
    include Yast2::Equatable
    extend Forwardable

    # @return [IPAddr] IP address
    attr_reader :address
    # @return [Integer] Prefix
    attr_accessor :prefix

    eql_attr :address, :prefix

    def_delegators :@address, :ipv4?, :ipv6?

    class << self
      def from_string(str)
        address, prefix = str.split("/")
        prefix = prefix.to_i if prefix
        new(address, prefix)
      end
    end

    # Constructor
    #
    # @param address [String] IP address without the prefix
    # @param prefix [Integer] IP prefix (number of bits). If not specified, 32 will be used for IPv4
    #   and 128 for IPv6.
    def initialize(address, prefix = nil)
      @address = IPAddr.new(address)
      @prefix = prefix
    end

    # Returns a string representation of the address
    def to_s
      prefix? ? "#{@address}/#{@prefix}" : @address.to_s
    end

    # Sets the prefix from a netmask
    #
    # @param netmask [String] String representation of the netmask
    def netmask=(netmask)
      self.prefix = IPAddr.new("#{netmask}/#{netmask}").prefix
    end

    # Sets the address from the string
    #
    # @param value [String] String representation of the address
    def address=(value)
      @address = IPAddr.new(value)
    end

    # Determines whether a prefix is defined
    #
    # @return [Boolean]
    def prefix?
      !!@prefix
    end
  end
end
