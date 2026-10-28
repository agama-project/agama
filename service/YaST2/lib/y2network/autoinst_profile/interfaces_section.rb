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

# Vendored from yast2-network's network/src/lib/y2network/autoinst_profile/interfaces_section.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-network`
# RPM is no longer a runtime dependency of Agama.

require "installation/autoinst_profile/section_with_attributes"
require "y2network/autoinst_profile/interface_section"

module Y2Network
  module AutoinstProfile
    # This class represents an AutoYaST <interfaces> section under <networking>
    #
    #   <interfaces config:type="list">
    #     <interface>
    #       <bootproto>dhcp</bootproto>
    #       <device>eth0</device>
    #       <startmode>auto</startmode>
    #     </interface>
    #     <interface>
    #       <bootproto>static</bootproto>
    #       <broadcast>127.255.255.255</broadcast>
    #       <device>lo</device>
    #       <firewall>no</firewall>
    #       <ipaddr>127.0.0.1</ipaddr>
    #       <lladdr>02:02:02:02:02:02</lladdr>
    #       <netmask>255.0.0.0</netmask>
    #       <network>127.0.0.0</network>
    #       <prefixlen>8</prefixlen>
    #       <startmode>nfsroot</startmode>
    #       <usercontrol>no</usercontrol>
    #     </interface>
    #   </interfaces>
    #
    # @see NetworkingSection
    class InterfacesSection < ::Installation::AutoinstProfile::SectionWithAttributes
      include Yast::Logger

      def self.attributes
        [
          { name: :interfaces }
        ]
      end

      define_attr_accessors

      # @!attribute interfaces
      #   @return [Array<InterfaceSection>]

      # Clones network interfaces settings into an AutoYaST interfaces section
      #
      # @param config [Y2Network::Config] whole config as it need both interfaces and
      #   connection configs
      # @param parent [SectionWithAttributes,nil] Parent section
      # @return [InterfacesSection]
      def self.new_from_network(config, parent = nil)
        result = new(parent)
        initialized = result.init_from_network(config)
        initialized ? result : nil
      end

      # Constructor
      def initialize(*_args)
        super
        @interfaces = []
      end

      # Method used by {.new_from_hashes} to populate the attributes when importing a profile
      #
      # @param hash [Array] see {.new_from_hashes}. In this case it is array of interfaces
      def init_from_hashes(hash)
        # we expect list of hashes here, remove everything else
        h = hash.delete_if { |v| !v.is_a?(Hash) }
        @interfaces = interfaces_from_hash(h)
      end

      # Method used by {.new_from_network} to populate the attributes when cloning routing settings
      #
      # @param connection_configs [Y2Network::ConnectionConfigsCollection] Network settings
      # @return [Boolean] Result true on success or false otherwise
      def init_from_network(connection_configs)
        @interfaces = interfaces_section(connection_configs)
        true
      end

    private

      # Returns an array of interfaces sections
      #
      # @param hash [Hash] Interfaces section hash
      def interfaces_from_hash(hash)
        hash.map do |h|
          h = h["device"] if h["device"].is_a? ::Hash # hash can be enclosed in different hash
          res = InterfaceSection.new_from_hashes(h, self)
          log.info "interfaces section #{res.inspect} load from hash #{h.inspect}"
          res
        end
      end

      def interfaces_section(connection_configs)
        connection_configs.map do |c|
          Y2Network::AutoinstProfile::InterfaceSection.new_from_network(c, self)
        end
      end
    end
  end
end
