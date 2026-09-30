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

# Vendored from yast2-network's network/src/lib/y2network/autoinst_profile/routing_section.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-network`
# RPM is no longer a runtime dependency of Agama.

require "installation/autoinst_profile/section_with_attributes"
require "y2network/autoinst_profile/route_section"

module Y2Network
  module AutoinstProfile
    # This class represents an AutoYaST <routing> section under <networking>
    #
    #  <routing>
    #    <ipv4_forward config:type="boolean">false</ipv4_forward>
    #    <ipv6_forward config:type="boolean">false</ipv6_forward>
    #    <routes config:type="list">
    #      <route> <!-- see RouteSection class -->
    #        <destination>192.168.1.0</destination>
    #        <device>eth0</device>
    #        <extrapara>foo</extrapara>
    #        <gateway>-</gateway>
    #        <netmask>-</netmask>
    #      </route>
    #    </routes>
    #  </routing>
    #
    # @see NetworkingSection
    class RoutingSection < ::Installation::AutoinstProfile::SectionWithAttributes
      def self.attributes
        [
          { name: :ipv4_forward },
          { name: :ipv6_forward },
          { name: :routes }
        ]
      end

      define_attr_accessors

      # @!attribute ipv4_forward
      #  @return [Boolean]

      # @!attribute ipv6_forward
      #  @return [Boolean]

      # @!attribute routes
      #   @return [Array<RouteSection>]

      # Clones network routing settings into an AutoYaST routing section
      #
      # @param routing [Y2Network::Routing] Routing settings
      # @param parent [SectionWithAttributes,nil] Parent section
      # @return [RoutingSection]
      def self.new_from_network(routing, parent = nil)
        result = new(parent)
        initialized = result.init_from_network(routing)
        initialized ? result : nil
      end

      # Constructor
      def initialize(*_args)
        super
        @routes = []
      end

      # Method used by {.new_from_hashes} to populate the attributes when importing a profile
      #
      # @param hash [Hash] see {.new_from_hashes}
      def init_from_hashes(hash)
        super
        ip_forward = hash["ip_forward"]
        @ipv4_forward = hash.fetch("ipv4_forward", ip_forward)
        @ipv6_forward = hash.fetch("ipv6_forward", ip_forward)
        @routes = routes_from_hash(hash)
      end

      # Method used by {.new_from_network} to populate the attributes when cloning routing settings
      #
      # @param routing [Y2Network::Routing] Network settings
      # @return [Boolean] Result true on success or false otherwise
      def init_from_network(routing)
        @ipv4_forward = routing.forward_ipv4
        @ipv6_forward = routing.forward_ipv6
        @routes = routes_section(routing.routes)
        true
      end

    private

      # Returns an array of routing sections
      #
      # @param hash [Hash] Routing section hash
      def routes_from_hash(hash)
        hashes = hash["routes"] || []
        hashes.map { |h| RouteSection.new_from_hashes(h, self) }
      end

      def routes_section(routes)
        routes.map { |r| Y2Network::AutoinstProfile::RouteSection.new_from_network(r, self) }
      end
    end
  end
end
