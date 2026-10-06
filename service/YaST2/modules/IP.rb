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

      Yast.import "Netmask"

      @ValidChars = "0123456789abcdefABCDEF.:"
      @ValidChars4 = "0123456789."
      @ValidChars6 = "0123456789abcdefABCDEF:"

      # helper list, each bit has its decimal representation
      @bit_weight_row = [128, 64, 32, 16, 8, 4, 2, 1]
    end

    # Describe a valid IPv4 address
    # @return [String] describtion a valid IPv4 address
    def Valid4
      # Translators: dot: "."
      _(
        "A valid IPv4 address consists of four integers\nin the range 0-255 separated by dots."
      )
    end

    # Check syntax of IPv4 address
    # @param [String] ip IPv4 address
    # @return true if correct
    def Check4(ip)
      IPAddr.new(ip).ipv4?
    rescue StandardError
      false
    end

    # Describe a valid IPv6 address
    # @return [String] describtion a valid IPv4 address
    def Valid6
      # Translators: colon: ":"
      _(
        "A valid IPv6 address consists of up to eight\n" \
        "hexadecimal numbers in the range 0 - FFFF separated by colons.\n" \
        "It can contain up to one double colon."
      )
    end

    # Check syntax of IPv6 address
    # @param [String] ip IPv6 address
    # @return true if correct
    def Check6(ip)
      IPAddr.new(ip).ipv6?
    rescue StandardError
      false
    end

    # If param contains IPv6 in one of its various forms, extracts it.
    #
    # if ip is closed in [ ] or contain % then it can be special case of IPv6 syntax,
    # so extract ipv6 (see description later) and continue with check.
    #
    # IPv6 syntax:
    # - pure ipv6 blob (e.g. f008::1)
    # - ipv6 blob with link local suffix (e.g. f008::1%eth0)
    # - dtto in square brackets (e.g. [f008::1%eth0] )
    #
    # @param [String] ip    a buffer with address
    # @return      IPv6 part of ip param, unchanged ip param otherwise
    def UndecorateIPv6(ip)
      if Builtins.regexpmatch(ip, "^\\[.*\\]") ||
          Builtins.regexpmatch(ip, "^[^][%]+(%[^][%]+){0,1}$")
        ip = Builtins.regexpsub(
          ip,
          "^\\[?([^][%]+)(%[^][%]+){0,1}(\\]|$)",
          "\\1"
        )
      end

      ip
    end

    # Check syntax of IP address
    # @param [String] ip IP address
    # @return true if correct
    def Check(ip)
      Check4(ip) || Check6(ip)
    end

    # Returns string of valid network definition.
    # Both IPv4 and IPv6.
    #
    # @return [String] describing the valid network.
    def ValidNetwork
      # TRANSLATORS: description of the valid network definition
      _(
        "A valid network definition can contain the IP,\n" \
        "IP/Netmask, IP/Netmask_Bits, or 0/0 for all networks.\n" \
        "\n" \
        "Examples:\n" \
        "IP: 192.168.0.1 or 2001:db8:0::1\n" \
        "IP/Netmask: 192.168.0.0/255.255.255.0 or 2001:db8:0::1/56\n" \
        "IP/Netmask_Bits: 192.168.0.0/24 or 192.168.0.1/32 or 2001:db8:0::1/ffff::0\n"
      )
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

    # Compute IPv4 network address from ip4 address and network mask.
    # @param [String] ip IPv4 address
    # @param [String] mask netmask
    # @return computed subnet
    def ComputeNetwork(ip, mask)
      i = ToInteger(ip)
      m = ToInteger(mask)
      ToString(Ops.bitwise_and(Ops.bitwise_and(i, m), 4_294_967_295))
    end

    # Compute IPv4 broadcast address from ip4 address and network mask.
    #
    # The broadcast address is the highest address of network address range.
    # @param [String] ip IPv4 address
    # @param [String] mask netmask
    # @return computed broadcast
    def ComputeBroadcast(ip, mask)
      i = ToInteger(ip)
      m = ToInteger(mask)
      ToString(
        Ops.bitwise_and(Ops.bitwise_or(i, Ops.bitwise_not(m)), 4_294_967_295)
      )
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

    def CheckNetworkShared(network)
      return false if network.nil? || network == ""

      # all networks
      (network == "0/0") ? true : nil
    end

    # Checks the given IPv4 network entry.
    #
    # @see CheckNetwork for details.
    # @see CheckNetwork6 for IPv6 version of the same function.
    #
    # @example
    #   CheckNetwork("192.168.0.0/255.255.255.0") -> true
    #   CheckNetwork("192.168.1.22") -> true
    #   CheckNetwork("172.55.0.0/33") -> false
    def CheckNetwork4(network)
      generic_check = CheckNetworkShared(network)
      return generic_check unless generic_check.nil?

      # 192.168.0.0/20, 0.8.55/158
      if network =~ Regexp.new("^[" + @ValidChars4 + "]+/[0-9]+$")
        net_parts = network.split("/")
        return Check4(net_parts[0]) &&
            Netmask.CheckPrefix4(net_parts[1])
      # 192.168.0.0/255.255.255.0, 0.8.55/10.258.12
      elsif network =~ Regexp.new("^[" + @ValidChars4 + "]+/[" + @ValidChars4 + "]+$")
        net_parts = network.split("/")
        return Check4(net_parts[0]) &&
            Netmask.Check4(net_parts[1])
      # 192.168.0.1, 0.8.55.999
      elsif Check4(network)
        return true
      end

      false
    end

    # Checks the given IPv6 network entry.
    #
    # @see CheckNetwork for details.
    # @see CheckNetwork4 for IPv4 version of the same function.
    #
    # @example
    #   CheckNetwork("2001:db8:0::1/64") -> true
    #   CheckNetwork("2001:db8:0::1") -> true
    #   CheckNetwork("::1/257") -> false
    def CheckNetwork6(network)
      generic_check = CheckNetworkShared(network)
      return generic_check unless generic_check.nil?

      # 2001:db8:0::1/64
      if network =~ Regexp.new("^[" + @ValidChars6 + "]+/[" + Netmask.ValidChars6 + "]*$")
        net_parts = network.split("/")
        return Check6(net_parts[0]) &&
            Netmask.Check6(net_parts[1])
      # 2001:db8:0::1/ffff:ffff::0
      elsif network =~ Regexp.new("^[" + @ValidChars6 + "]+/[" + @ValidChars6 + "]+$")
        net_parts = network.split("/")
        return Check6(net_parts[0]) &&
            Check6(net_parts[1])
      # 2001:db8:0::1
      elsif Check6(network)
        return true
      end

      false
    end

    # Checks the given network entry which can be defined in several formats:
    #   - Single IPv4 or IPv6, e.g., 192.168.0.1 or 2001:db8:0::1
    #   - IP/Netmask, e.g., 192.168.0.0/255.255.255.0 or 2001:db8:0::1/ffff:ffff::0
    #   - IP/CIDR, e.g., 192.168.0.0/20 or 2001:db8:0::1/56
    #
    # @example
    #  CheckNetwork("192.168.0.1") -> true
    #  CheckNetwork("192.168.0.0/20") -> true
    #  CheckNetwork("192.168.0.0/255.255.255.0") -> true
    #  CheckNetwork("0/0") -> true
    #  CheckNetwork("::1/128") -> true
    #  CheckNetwork("2001:db8:0::1") -> true
    #  CheckNetwork("2001:db8:0::1/64") -> true
    #  CheckNetwork("2001:db8:0::1/ffff:ffff::0") -> true
    #  CheckNetwork("2001:db8:0::xyz") -> false
    #  CheckNetwork("::1/257") -> false
    #  CheckNetwork("172.55.0.0/33") -> false
    #  CheckNetwork("172.55.0.0/125.85.5.5") -> false
    def CheckNetwork(network)
      CheckNetwork4(network) || CheckNetwork6(network)
    end

    # Checks if given IPv4 address is reserved by any related RFC.
    #
    # RFCs covered by this method are #1700, #1918, #2544, #3068, #5735, #5737,
    # 5771, #6333 and #6598
    #
    # @param[String] ip IPv4 address
    # @return[true,false] if address is reserved
    #
    # @raise [RuntimeError] if ip address is invalid
    def reserved4(ip)
      raise "Invalid IP address passed '#{ip}'" unless Check4(ip)

      # RFC#1700
      return true if ip.start_with?("0.")

      # RFC#6598
      return true if private_carrier_grade_nat?(ip)

      # RFC#5735
      return true if ip.start_with?("127.")
      return true if ip.start_with?("169.254")

      # RFC#1918
      return true if private_network?(ip)

      # RFC#6333
      return true if ds_lite_address?(ip)

      # RFC#5737
      return true if ip.start_with?("192.0.2.")
      return true if ip.start_with?("198.51.100.")
      return true if ip.start_with?("203.0.113.")

      # RFC#3068
      return true if ip.start_with?("192.88.99.")

      # RFC#2544
      return true if ip.start_with?("192.18.")
      return true if ip.start_with?("192.19.")

      # all from 224. is covered by RFC#5771 and RFC#5735
      return true if (224..255).cover?(ip.split(".").first.to_i)

      false
    end

    publish variable: :ValidChars, type: "string"
    publish variable: :ValidChars4, type: "string"
    publish variable: :ValidChars6, type: "string"
    publish function: :Valid4, type: "string ()"
    publish function: :Check4, type: "boolean (string)"
    publish function: :Valid6, type: "string ()"
    publish function: :Check6, type: "boolean (string)"
    publish function: :UndecorateIPv6, type: "string (string)"
    publish function: :Check, type: "boolean (string)"
    publish function: :ValidNetwork, type: "string ()"
    publish function: :ToInteger, type: "integer (string)"
    publish function: :ToString, type: "string (integer)"
    publish function: :ToHex, type: "string (string)"
    publish function: :ComputeNetwork, type: "string (string, string)"
    publish function: :ComputeBroadcast, type: "string (string, string)"
    publish function: :IPv4ToBits, type: "string (string)"
    publish function: :BitsToIPv4, type: "string (string)"
    publish function: :CheckNetwork4, type: "boolean (string)"
    publish function: :CheckNetwork6, type: "boolean (string)"
    publish function: :CheckNetwork, type: "boolean (string)"
    publish function: :reserved4, type: "boolean (string)"

  private

    def private_carrier_grade_nat?(ip)
      return false unless ip.start_with?("100.")

      second_part = ip.split(".")[1].to_i
      (64..127).cover?(second_part)
    end

    def private_network?(ip)
      # 10.0.0.0/8
      return true if ip.start_with?("10.")

      # 192.168.0.0/8
      return true if ip.start_with?("192.168.")

      # 172.16.0.0/12
      return false unless ip.start_with?("172.")

      second_part = ip.split(".")[1].to_i
      (16..31).cover?(second_part)
    end

    def ds_lite_address?(ip)
      return false unless ip.start_with?("192.0.0.")

      fourth_part = ip.split(".")[3].to_i
      (0..7).cover?(fourth_part)
    end
  end

  IP = IPClass.new
  IP.main
end
