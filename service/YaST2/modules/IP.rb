# ***************************************************************************
#
# Copyright (c) 2002 - 2012 Novell, Inc.
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of version 2 of the GNU General Public License as
# published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.   See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, contact Novell, Inc.
#
# To contact Novell about this file by physical or electronic mail,
# you may find current contact information at www.novell.com
#
# ***************************************************************************
# File:  modules/IP.ycp
# Module:  yast2
# Summary:  IP manipulation routines
# Authors:  Michal Svec <msvec@suse.cz>
# Flags:  Stable
#
# $Id$
require "yast"
require "resolv"
require "ipaddr"

module Yast
  class IPClass < Module
    include Yast::Logger

    def main
      textdomain "base"

      @ValidChars = "0123456789abcdefABCDEF.:"
      @ValidChars4 = "0123456789."
      @ValidChars6 = "0123456789abcdefABCDEF:"

      # helper list, each bit has its decimal representation
      @bit_weight_row = [128, 64, 32, 16, 8, 4, 2, 1]
    end

    # Check syntax of IPv4 address
    # @param [String] ip IPv4 address
    # @return true if correct
    def Check4(ip)
      IPAddr.new(ip).ipv4?
    rescue StandardError
      false
    end

    # Check syntax of IPv6 address
    # @param [String] ip IPv6 address
    # @return true if correct
    def Check6(ip)
      IPAddr.new(ip).ipv6?
    rescue StandardError
      false
    end

    # Check syntax of IP address
    # @param [String] ip IP address
    # @return true if correct
    def Check(ip)
      Check4(ip) || Check6(ip)
    end

    # Convert IPv4 address from string to integer
    # @param [String] ip IPv4 address
    # @return ip address as integer
    def ToInteger(ip)
      return nil unless Check4(ip)

      IPAddr.new(ip).to_i
    end

    # Convert IPv4 address from integer to string
    # @param [Fixnum] ip IPv4 address
    # @return ip address as string
    def ToString(ip)
      IPAddr.new(ip, Socket::AF_INET).to_s
    end

    # Converts IPv4 address from string to hex format
    # @param [String] ip IPv4 address as string in "ipv4" format
    # @return [String] representing IP in Hex
    # @example IP::ToHex("192.168.1.1") -> "C0A80101"
    # @example IP::ToHex("10.10.0.1") -> "0A0A0001"
    def ToHex(ip)
      int = ToInteger(ip)
      return nil unless int

      format("%08X", int)
    end

    # Converts IPv4 into its 32 bit binary representation.
    #
    # @param [String] ipv4
    # @return [String] binary
    #
    # @see #BitsToIPv4()
    #
    # @example
    #     IPv4ToBits("80.25.135.2")    -> "01010000000110011000011100000010"
    #     IPv4ToBits("172.24.233.211") -> "10101100000110001110100111010011"
    def IPv4ToBits(ipv4)
      int = ToInteger(ipv4)
      return nil unless int

      format("%032b", int)
    end

    # Converts 32 bit binary number to its IPv4 representation.
    #
    # @param string binary
    # @return [String] ipv4
    #
    # @see #IPv4ToBits()
    #
    # @example
    #     BitsToIPv4("10111100000110001110001100000101") -> "188.24.227.5"
    #     BitsToIPv4("00110101000110001110001001100101") -> "53.24.226.101"
    def BitsToIPv4(bits)
      return nil unless /\A[01]{32}\z/ =~ bits

      ToString(bits.to_i(2))
    end

    publish variable: :ValidChars, type: "string"
    publish variable: :ValidChars4, type: "string"
    publish variable: :ValidChars6, type: "string"
    publish function: :Check4, type: "boolean (string)"
    publish function: :Check6, type: "boolean (string)"
    publish function: :Check, type: "boolean (string)"
    publish function: :ToInteger, type: "integer (string)"
    publish function: :ToString, type: "string (integer)"
    publish function: :ToHex, type: "string (string)"
    publish function: :IPv4ToBits, type: "string (string)"
    publish function: :BitsToIPv4, type: "string (string)"
    publish function: :CheckNetwork4, type: "boolean (string)"
    publish function: :CheckNetwork6, type: "boolean (string)"
    publish function: :CheckNetwork, type: "boolean (string)"
  end

  IP = IPClass.new
  IP.main
end
