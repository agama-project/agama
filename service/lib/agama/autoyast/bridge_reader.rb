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
    # Builds an Agama "bridge" section from an AutoYaST InterfaceSection.
    class BridgeReader
      # Values that are considered to be "true" in an AutoYaST profile.
      #
      # The schema only allows "yes"/"no" for `bridge` and "on"/"off" for `bridge_stp`, but
      # profiles in the wild use other spellings too.
      TRUE_VALUES = ["yes", "true", "on", "1"].freeze
      private_constant :TRUE_VALUES

      # @param section [Y2Network::AutoinstProfile::InterfaceSection] Interface section
      #   Section to extract the information from
      def initialize(section)
        @section = section
      end

      # Returns a hash that corresponds to Agama "bridge" section
      #
      # The result could include "ports", "stp" and "forwardDelay" keys. If the interface is
      # not a bridge, it returns an empty hash.
      #
      # @return [Hash]
      def read
        return {} unless bridge?

        bridge = {}
        bridge["ports"] = ports unless ports.empty?

        stp = read_stp
        bridge["stp"] = stp unless stp.nil?

        forward_delay = read_forward_delay
        bridge["forwardDelay"] = forward_delay unless forward_delay.nil?

        { "bridge" => bridge }
      end

    private

      attr_reader :section

      # Whether the interface must be handled as a bridge
      #
      # Like YaST does, an interface defining ports is considered a bridge. Additionally, an
      # interface explicitly marked with `<bridge>yes</bridge>` is handled as a bridge too,
      # even if it does not define any port.
      #
      # @return [Boolean]
      def bridge?
        return true unless ports.empty?

        TRUE_VALUES.include?(section.bridge.to_s.downcase)
      end

      # Reads the bridge ports.
      #
      # @return [Array<String>]
      def ports
        @ports ||= section.bridge_ports.to_s.split
      end

      # Reads whether the Spanning Tree Protocol is enabled.
      #
      # @return [Boolean, nil] nil if it is not defined.
      def read_stp
        value = section.bridge_stp.to_s.downcase
        return nil if value.empty?

        TRUE_VALUES.include?(value)
      end

      # Reads the Spanning Tree Protocol forwarding delay, in seconds.
      #
      # Negative values are ignored because Agama does not accept them.
      #
      # @return [Integer, nil] nil if it is not defined.
      def read_forward_delay
        value = section.bridge_forward_delay.to_s
        return nil if value.empty?

        delay = value.to_i
        delay.negative? ? nil : delay
      end
    end
  end
end
