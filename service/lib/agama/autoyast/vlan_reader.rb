# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

module Agama
  module AutoYaST
    # Builds an Agama "vlan" section from an AutoYaST InterfaceSection.
    class VlanReader
      # Maximum VLAN identifier (4095 is reserved, so NetworkManager does not accept it).
      MAX_ID = 4094
      private_constant :MAX_ID

      # Matches the "parent.id" notation used to name VLAN devices (e.g., "eth0.10").
      DEVICE_NAME_REGEXP = /\A(?<parent>.+)\.(?<id>\d+)\z/.freeze
      private_constant :DEVICE_NAME_REGEXP

      # @param section [Y2Network::AutoinstProfile::InterfaceSection] Interface section
      #   Section to extract the information from
      def initialize(section)
        @section = section
      end

      # Returns a hash that corresponds to Agama "vlan" section
      #
      # Agama needs both the VLAN identifier and the parent interface. If any of them is
      # missing, and it cannot be inferred from the device name, it returns an empty hash.
      # Otherwise the generated profile would be invalid, causing the whole installation to
      # fail instead of just ignoring the offending interface.
      #
      # @return [Hash]
      def read
        return {} unless vlan?

        id = read_id
        parent = read_parent
        return {} if id.nil? || parent.nil?

        { "vlan" => { "id" => id, "parent" => parent } }
      end

    private

      attr_reader :section

      # Whether the interface must be handled as a VLAN
      #
      # YaST relies on the `etherdevice` element, but an interface defining only a `vlan_id`
      # is handled too.
      #
      # @return [Boolean]
      def vlan?
        !section.etherdevice.to_s.empty? || !section.vlan_id.to_s.empty?
      end

      # VLAN identifier
      #
      # It is read from the `vlan_id` element. As a fallback, it is inferred from the device
      # name (e.g., 10 for "eth0.10").
      #
      # @return [Integer, nil] nil if it is unknown or out of range.
      def read_id
        value = section.vlan_id.to_s
        value = device_name_parts[:id] if value.empty? && device_name_parts
        return nil if value.to_s.empty?

        id = value.to_i
        (0..MAX_ID).cover?(id) ? id : nil
      end

      # Parent interface
      #
      # It is read from the `etherdevice` element. As a fallback, it is inferred from the
      # device name (e.g., "eth0" for "eth0.10"). Names like "vlan10" are not considered
      # because they do not carry any information about the parent interface.
      #
      # @return [String, nil] nil if it is unknown.
      def read_parent
        parent = section.etherdevice.to_s
        parent = device_name_parts[:parent] if parent.empty? && device_name_parts
        parent.to_s.empty? ? nil : parent
      end

      # Name of the device the section refers to.
      #
      # @return [String]
      def device_name
        name = section.device.to_s
        name.empty? ? section.name.to_s : name
      end

      # Device name parsed using the "parent.id" notation.
      #
      # @return [MatchData, nil] nil if the name does not follow that notation.
      def device_name_parts
        return @device_name_parts if defined?(@device_name_parts)

        @device_name_parts = DEVICE_NAME_REGEXP.match(device_name)
      end
    end
  end
end
