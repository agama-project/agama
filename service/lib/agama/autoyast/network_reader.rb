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

require "y2network/autoinst_profile/networking_section"
require "agama/autoyast/connections_reader"

module Agama
  module AutoYaST
    # Builds the Agama "network" section from an AutoYaST profile.
    class NetworkReader
      # @param profile [ProfileHash] AutoYaST profile
      def initialize(profile)
        @profile = profile
      end

      # @return [Hash] Agama "user" section
      def read
        networking = profile.fetch_as_hash("networking")
        return {} if networking.empty?

        section = Y2Network::AutoinstProfile::NetworkingSection.new_from_hashes(networking)
        dns = read_dns_settings(section.dns)
        connections = read_connections(section.interfaces, dns)
        return {} if connections.empty?

        { "network" => connections }
      end

    private

      attr_reader :profile

      def ipv6?
        profile.fetch_as_hash("networking").fetch("ipv6", false)
      end

      # @param interfaces [Y2Network::AutoinstProfile::Interfaces, nil] AutoYaST interfaces section.
      # @param dns [Hash] Agama DNS settings.
      def read_connections(interfaces, dns)
        return [] if interfaces.nil?

        connections_reader = Agama::AutoYaST::ConnectionsReader.new(
          interfaces, ipv6: ipv6?, dns: dns
        )
        connections_reader.read
      end

      # Reads an AutoYaST DNS section and builds its equivalent hash.
      #
      # @param dns_section [Y2Network::AutoinstProfile::DNSSection, nil] DNS section.
      # @return [Hash]
      def read_dns_settings(dns_section)
        dns = {}
        return dns if dns_section.nil?

        dns["dns_searchlist"] = dns_section.searchlist unless dns_section.searchlist.empty?
        dns["nameservers"] = dns_section.nameservers unless dns_section.nameservers.empty?
        dns
      end
    end
  end
end
