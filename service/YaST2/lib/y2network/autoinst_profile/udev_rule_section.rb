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

# Vendored from yast2-network's network/src/lib/y2network/autoinst_profile/udev_rule_section.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-network`
# RPM is no longer a runtime dependency of Agama.

require "installation/autoinst_profile/section_with_attributes"

module Y2Network
  module AutoinstProfile
    # This class represents an AutoYaST <rule> section under <net-udev>
    #
    # @example xml content
    #   <rule>
    #     <name>eth0</name>
    #     <rule>ATTR\{address\}</rule>
    #     <value>00:30:6E:08:EC:80</value>
    #   </rule>
    #
    # @see InterfacesSection
    class UdevRuleSection < ::Installation::AutoinstProfile::SectionWithAttributes
      include Yast::Logger

      def self.attributes
        [
          { name: :rule },
          { name: :value },
          { name: :name }
        ]
      end

      define_attr_accessors

      # @!attribute rule
      #  @return [String] type of rule. Supported now is `ATTR\{address\}` and `KERNELS`.
      #    The first one is for MAC based rules and second for bus id based ones.

      # @!attribute value
      #  @return [String] mac or bus id value

      # @!attribute name
      #  @return [String] device name that should be used.

      # Clones a network interface into an AutoYaST udev rule section
      #
      # @param interface [Y2Network::Interface]
      # @param parent [SectionWithAttributes,nil] Parent section
      # @return [InterfacesSection, nil] Udev rule section or nil if udev naming is not implemented
      #   for interface
      def self.new_from_network(interface, parent = nil)
        return if interface.renaming_mechanism == :none
        return unless interface.hardware

        new(parent).tap { |r| r.init_from_config(interface) }
      end

      def initialize(*_args)
        super

        self.class.attributes.each do |attr|
          # init everything to empty string
          public_send(:"#{attr[:name]}=", "")
        end
      end

      # mapping of renaming_mechanism to rule string
      RULE_MAPPING = {
        mac:    "ATTR{address}",
        bus_id: "KERNELS"
      }.freeze

      # mapping of renaming_mechanism to method to obtain value
      VALUE_MAPPING = {
        mac:    :mac,
        bus_id: :busid
      }.freeze

      # Method used by {.new_from_network} to populate the attributes when cloning a udev rule
      #
      # @param interface [Y2Network::Interface]
      def init_from_config(interface)
        @name = interface.name
        @rule = RULE_MAPPING[interface.renaming_mechanism] or
          raise("invalid renaming mechanism #{interface.renaming_mechanism}")
        @value = interface.hardware.public_send(VALUE_MAPPING[interface.renaming_mechanism])
      end

      # helper to get mechanism symbol from rule
      # @return [Symbol] mechanism corresponding to {Interface#renaming_mechanism}
      def mechanism
        RULE_MAPPING.each_pair { |k, v| return k if v == rule }
      end

      # Returns the collection name
      #
      # @return [String] "udev_rules"
      def collection_name
        "udev_rules"
      end

      # Returns the section path
      #
      # @return [Installation::AutoinstProfile::ElementPath,nil] Section path or
      #   nil if the parent is not set
      def section_path
        return nil unless parent

        parent.section_path.join(index)
      end
    end
  end
end
