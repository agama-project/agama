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

# Vendored from yast2-network's network/src/lib/y2network/autoinst_profile/dns_section.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-network`
# RPM is no longer a runtime dependency of Agama.

require "installation/autoinst_profile/section_with_attributes"

module Y2Network
  module AutoinstProfile
    # This class represents an AutoYaST <dns> section under <networking>
    #
    #  <dns>
    #    <dhcp_hostname config:type="boolean">true</dhcp_hostname>
    #    <hostname>linux.example.org</hostname>
    #    <nameservers config:type="list">
    #      <nameserver>192.168.122.1</nameserver>
    #      <nameserver>10.0.0.2</nameserver>
    #    </nameservers>
    #    <resolv_conf_policy>auto</resolv_conf_policy>
    #    <searchlist config:type="list">
    #      <search>example.net</search>
    #      <search>example.org</search>
    #    </searchlist>
    #  </dns>
    class DNSSection < ::Installation::AutoinstProfile::SectionWithAttributes
      def self.attributes
        [
          { name: :dhcp_hostname },
          { name: :hostname },
          { name: :nameservers },
          { name: :resolv_conf_policy },
          { name: :searchlist }
        ]
      end

      define_attr_accessors

      # @!attribute dhcp_hostname
      #   @return [Boolean]

      # @!attribute domain
      #   @return [String]

      # @!attribute hostname
      #   @return [String]

      # @!attribute nameservers
      #   @return [Array<String>]

      # @!attribute resolv_conf_policy
      #   @return [Array<String>]

      # @!attribute searchlist
      #   @return [Array<String>]

      # Clones network dns settings into an AutoYaST dns section
      #
      # @param dns [Y2Network::DNS] DNS settings
      # @param hostname [Y2Network::Hostname] Hostname settings
      # @param parent [SectionWithAttributes,nil] Parent section
      # @return [DNSSection]
      # NOTE: we need both DNS and Hostname settings because of historical reasons
      # when both used to be handled in one class / module
      def self.new_from_network(dns, hostname, parent = nil)
        result = new(parent)
        initialized = result.init_from_network(dns, hostname)
        initialized ? result : nil
      end

      # Constructor
      def initialize(*_args)
        super
        @nameservers = []
        @searchlist = []
      end

      # Method used by {.new_from_hashes} to populate the attributes when importing a profile
      #
      # @param hash [Hash] see {.new_from_hashes}
      def init_from_hashes(hash)
        super
        @nameservers = hash["nameservers"] || []
        @searchlist = hash["searchlist"] || []
      end

      # Method used by {.new_from_network} to populate the attributes when cloning DNS options
      #
      # @param dns      [Y2Network::DNS] DNS settings
      # @param hostname [Y2Network::Hostname] Hostname settings
      #
      # @return [Boolean] Result true on success or false otherwise
      def init_from_network(dns, hostname)
        @dhcp_hostname = hostname.dhcp_hostname == :any
        @hostname = hostname.hostname
        @nameservers = dns.nameservers.map(&:to_s)
        @resolv_conf_policy = dns.resolv_conf_policy
        @searchlist = dns.searchlist
        true
      end
    end
  end
end
