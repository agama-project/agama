# Copyright (c) [2021] SUSE LLC
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

# Vendored from yast2-network's network/src/lib/y2network/autoinst_profile/alias_section.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-network`
# RPM is no longer a runtime dependency of Agama.

require "installation/autoinst_profile/section_with_attributes"

module Y2Network
  module AutoinstProfile
    # This class represents an alias specification within the <interface> section.
    #
    # <aliases>
    #   <alias0>
    #     <IPADDR>192.168.1.100</IPADDR>
    #     <LABEL>1</LABEL>
    #     <PREFIXLEN>24</PREFIXLEN>
    #   </alias0>
    # </aliases>
    #
    # It is case insensitive.
    #
    # @see InterfaceSection
    class AliasSection < ::Installation::AutoinstProfile::SectionWithAttributes
      def self.attributes
        [
          { name: :ipaddr },
          { name: :label },
          { name: :prefixlen },
          { name: :netmask }
        ]
      end

      define_attr_accessors

      # @!attribute ipaddr
      #  @return [String] IP address

      # @!attribute label
      #  @return [String] alias label

      # @!attribute prefixlen
      #  @return [String] prefix length
      #
      # @!attribute netmask
      #  @return [String] IP netmask

      # Clones an IP config into an AutoYaST alias section
      #
      # @param config [Y2Network::ConnectionConfig::IPConfig] IP address configuration
      # @return [AliasSection]
      def self.new_from_network(config)
        result = new
        result.init_from_config(config)
        result
      end

      # Method used by {.new_from_network} to populate the attributes when cloning an IP config
      #
      # @param config [Y2Network::ConnectionConfig]
      # @return [Boolean]
      def init_from_config(config)
        @ipaddr = config.address&.address&.to_s
        @label = config.label
        @prefixlen = config.address&.prefix&.to_s
      end

      # Method used by {.new_from_hashes} to populate the attributes using a hash
      #
      # @param config [Hash]
      # @return [Boolean]
      def init_from_hashes(config)
        normalized_config = config.transform_keys(&:downcase)
        super(normalized_config)
      end
    end
  end
end
