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

# Vendored from yast2-network's network/src/lib/y2network/autoinst_profile/networking_section.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-network`
# RPM is no longer a runtime dependency of Agama.

require "installation/autoinst_profile/section_with_attributes"
require "y2network/autoinst_profile/dns_section"
require "y2network/autoinst_profile/interfaces_section"
require "y2network/autoinst_profile/routing_section"
require "y2network/autoinst_profile/udev_rules_section"
require "y2network/autoinst_profile/s390_devices_section"

module Y2Network
  module AutoinstProfile
    # This class represents an AutoYaST \<networking> section
    #
    #  <networking>
    #    <routing>
    #      <!-- the routing configuration -->
    #    </routing>
    #  </networking>
    #
    # @see RoutingSection
    class NetworkingSection < Installation::AutoinstProfile::SectionWithAttributes
      def self.attributes
        [
          { name: :setup_before_proposal },
          { name: :start_immediately },
          { name: :keep_install_network },
          { name: :virt_bridge_proposal },
          { name: :strict_ip_check_timeout },
          { name: :routing },
          { name: :dns },
          { name: :interfaces },
          { name: :udev_rules },
          { name: :s390_devices },
          { name: :managed },
          { name: :backend }
        ]
      end

      define_attr_accessors

      # @!attribute setup_before_proposal
      #  @return [Boolean]
      # @!attribute start_immediately
      #  @return [Boolean]
      # @!attribute keep_install_network
      #  @return [Boolean]
      # @!attribute virt_bridge_proposal
      #  @return [Boolean]
      # @!attribute strict_ip_check_timeout
      #  @return [Boolean]
      # @!attribute routing
      #   @return [RoutingSection]
      # @!attribute dns
      #   @return [DNSSection]
      # @!attribute interfaces
      #   @return [InterfacesSection]
      # @!attribute udev_rules
      #   @return [UdevRulesSection]
      # @!attribute s390_devices
      #   @return [S390DevicesSection]
      # @!attribute managed
      #   @return [Boolean]
      # @!attribute backend
      #   @return [String]

      # Creates an instance based on the profile representation used by the AutoYaST modules
      # (hash with nested hashes and arrays).
      #
      # @param hash [Hash] Networking section from an AutoYaST profile
      # @return [NetworkingSection]
      def self.new_from_hashes(hash)
        result = new
        result.backend = hash["backend"]
        result.managed = hash["managed"]
        result.setup_before_proposal = hash["setup_before_proposal"]
        result.start_immediately = hash["start_immediately"]
        result.keep_install_network = hash["keep_install_network"]
        result.virt_bridge_proposal = hash["virt_bridge_proposal"]
        result.strict_ip_check_timeout = hash["strict_ip_check_timeout"]
        result.routing = RoutingSection.new_from_hashes(hash["routing"], result) if hash["routing"]
        result.dns = DNSSection.new_from_hashes(hash["dns"], result) if hash["dns"]
        if hash["interfaces"]
          result.interfaces = InterfacesSection.new_from_hashes(hash["interfaces"], result)
        end
        if hash["net-udev"]
          result.udev_rules = UdevRulesSection.new_from_hashes(hash["net-udev"], result)
        end
        if hash["s390-devices"]
          result.s390_devices = S390DevicesSection.new_from_hashes(hash["s390-devices"], result)
        end
        result
      end

      # Creates an instance based on the network configuration representation
      #
      # @param config [Y2Network::Config]
      # @return [NetworkingSection]
      def self.new_from_network(config)
        result = new
        return result unless config

        result.managed = config.backend?(:network_manager)
        result.backend = config.backend&.id.to_s if config.backend
        build_dns = config.dns || config.hostname

        result.routing = RoutingSection.new_from_network(config.routing) if config.routing
        result.dns = DNSSection.new_from_network(config.dns, config.hostname) if build_dns
        result.interfaces = InterfacesSection.new_from_network(config.connections, result)
        result.udev_rules = UdevRulesSection.new_from_network(config.interfaces)
        result.s390_devices = S390DevicesSection.new_from_network(config.connections)
        result
      end

      # Export the section to a hash so it might be used when cloning the system
      #
      # @return [Hash]
      def to_hashes
        result = {}
        result["dns"] = dns&.to_hashes || {}
        unless managed
          result["routing"] = routing&.to_hashes || {}
          result["net-udev"] = udev_rules&.udev_rules&.map(&:to_hashes) || []
          result["interfaces"] = interfaces&.interfaces&.map(&:to_hashes) || []
          result["s390-devices"] = s390_devices&.to_hashes&.fetch("devices", []) || []
        end

        result.each_key { |k| result.delete(k) if result[k].empty? }
        result["managed"] = true if managed
        result["backend"] = backend if backend
        result
      end
    end
  end
end
