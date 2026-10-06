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

# Vendored from yast2-network's network/src/lib/y2network/autoinst_profile/route_section.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-network`
# RPM is no longer a runtime dependency of Agama.

require "installation/autoinst_profile/section_with_attributes"

module Y2Network
  module AutoinstProfile
    # This class represents an AutoYaST <route> section under <routing>
    #
    #  <route>
    #    <destination>192.168.1.0</destination>
    #    <device>eth0</device>
    #    <extrapara>foo</extrapara>
    #    <gateway>-</gateway>
    #    <netmask>-</netmask>
    #  </route>
    #
    # @see RoutingSection
    class RouteSection < ::Installation::AutoinstProfile::SectionWithAttributes
      def self.attributes
        [
          { name: :destination },
          { name: :netmask },
          { name: :device },
          { name: :gateway },
          { name: :extrapara }
        ]
      end

      define_attr_accessors

      # @!attribute destination
      #  @return [String] Route destination

      # @!attribute device
      #  @return [String] Interface name

      # @!attribute extrapara
      #  @return [String] Route options

      # @!attribute gateway
      #  @return [String] Route gateway

      # @!attribute netmask
      #  @return [String] Netmask

      # Clones a network route into an AutoYaST route section
      #
      # @param parent [SectionWithAttributes,nil] Parent section
      # @param route [Y2Network::Route] Network route
      # @return [RouteSection]
      def self.new_from_network(route, parent = nil)
        result = new(parent)
        result.init_from_route(route)
        result
      end

      # Method used by {.new_from_hashes} to populate the attributes.
      #
      # @param hash [Hash] see {.new_from_hashes}
      # @return [Boolean]
      def init_from_hashes(hash)
        @destination = destination_from_hash(hash)
        @gateway = gateway_from_hash(hash)
        @netmask = netmask_from_hash(hash)
        @device = device_from_hash(hash)
        @extrapara = hash["extrapara"]

        true
      end

      # Method used by {.new_from_network} to populate the attributes when cloning a network route
      #
      # @param route [Y2Network::Route] Network route
      # @return [Boolean]
      def init_from_route(route)
        @destination = destination_from_route(route)
        @netmask = netmask_from_route(route)
        @device = device_from_route(route)
        @gateway = gateway_from_route(route)
        @extrapara = extrapara_from_route(route)
        true
      end

      # Returns the collection name
      #
      # @return [String] "routes"
      def collection_name
        "routes"
      end

    private

      def destination_from_hash(hash)
        (hash["destination"] == "default") ? :default : hash["destination"]
      end

      def gateway_from_hash(hash)
        hash["gateway"] if hash["gateway"] != "-"
      end

      def netmask_from_hash(hash)
        hash["netmask"] if hash["netmask"] != "-"
      end

      def device_from_hash(hash)
        hash["device"] if hash["device"] != "-"
      end

      # Returns the destination for the given route
      #
      # @param route [Route] Route to get the destination from
      # @return [String] Route destination
      def destination_from_route(route)
        route.default? ? "default" : route.to.to_s
      end

      IPV4_MASK = "255.255.255.255".freeze
      IPV6_MASK = "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff".freeze

      # Returns the netmask
      #
      # @param route [Route] Route to get the destination from
      # @return [String] Route netmask
      def netmask_from_route(route)
        return "-" if route.default?

        mask = route.to.ipv4? ? IPV4_MASK : IPV6_MASK
        IPAddr.new(mask).mask(route.to.prefix).to_s
      end

      # Returns the device (interface) for the given route
      #
      # @param route [Route] Route to get the device from
      # @return [String] Device name
      def device_from_route(route)
        return "-" unless route.interface.respond_to?(:name)

        route.interface.name
      end

      # Returns the gateway for the given route
      #
      # @param route [Route] Route to get the gateway from
      # @return [String] Gateway address
      def gateway_from_route(route)
        return "-" unless route.gateway

        route.gateway.to_s
      end

      # Returns the extra parameters for the given route
      #
      # @param route [Route] Route to get the options from
      # @return [String] Extra parameters
      def extrapara_from_route(route)
        route.options.to_s
      end
    end
  end
end
