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

# Vendored from yast2-network's network/src/lib/y2network/boot_protocol.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-network`
# RPM is no longer a runtime dependency of Agama.

require "yast"
require "yast2/equatable"

module Y2Network
  # This class represents the boot protocols which are supported (not all by all backends).
  class BootProtocol
    include Yast2::Equatable

    class << self
      # Returns all the existing protocols
      #
      # @return [Array<BootProtocol>]
      def all
        @all ||= BootProtocol.constants
          .map { |c| BootProtocol.const_get(c) }
          .select { |c| c.is_a?(BootProtocol) }
      end

      # Returns the boot protocol with a given name
      #
      # @param name [String]
      # @return [BootProtocol,nil] Boot protocol or nil if not found
      def from_name(name)
        all.find { |t| t.name == name }
      end
    end

    # @return [String] Returns protocol name
    attr_reader :name
    alias_method :to_s, :name

    eql_attr :name

    # Constructor
    #
    # @param name [String] protocol name
    def initialize(name)
      @name = name
    end

    # checks if boot protocol is at least partially configured by dhcp
    #
    # @return [Boolean]
    def dhcp?
      [DHCP4, DHCP6, DHCP, DHCP_AUTOIP].include?(self)
    end

    # Checks if boot protocol is static
    #
    # @return [Boolean]
    def static?
      STATIC == self
    end

    # iBFT boot protocol
    IBFT = new("ibft")
    # statically assigned interface properties
    STATIC = new("static")
    # DHCP for both ipv4 and ipv6
    DHCP = new("dhcp")
    # DHCP for ipv4 only
    DHCP4 = new("dhcp4")
    # DHCP for ipv6 only
    DHCP6 = new("dhcp6")
    # combination of zeroconf for ipv4 and DHCP for ipv6
    DHCP_AUTOIP = new("dhcp+autoip")
    # zeroconf for ipv4
    AUTOIP = new("autoip")
    # do not assign properties. Usefull for bond port or bridge port
    NONE = new("none")
  end
end
