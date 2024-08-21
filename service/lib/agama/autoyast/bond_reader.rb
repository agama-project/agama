#!/usr/bin/env ruby
# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require "yast"
require "y2network/wireless_auth_mode"
require "y2network/wireless_mode"

# :nodoc:
module Agama
  module AutoYaST
    # Builds an Agama "bond" section from an AutoYaST InterfaceSection.
    class BondReader
      # @param section [Y2Network::AutoinstProfile::InterfaceSection] Interface section
      #   Section to extract the information from
      def initialize(section)
        @section = section
      end

      # Returns a hash that corresponds to Agama "bond" section
      #
      # The result could include "ports", "mode" and "options" keys. If there is
      # no bonding information, it returns an empty hash.
      #
      # @return [Hash]
      def read
        bond = {}

        ports = read_ports
        bond["ports"] = ports unless ports.empty?

        mode = read_mode
        bond["mode"] = mode unless mode.nil?

        options = read_options
        bond["options"] = options unless options.to_s.empty?

        return {} if bond.empty?

        { "bond" => bond }
      end

    private

      attr_reader :section

      # Reads the bonding ports.
      #
      # @return [Array<String>]
      def read_ports
        (0..9).map { |i| section.send("bonding_slave#{i}").to_s }.reject(&:empty?)
      end

      # Extracts the `mode` from the kernel module options.
      #
      # @return [String, nil]
      def read_mode
        options = section.bonding_module_opts.to_s
        return nil if options.empty?

        options[/mode=\S+/].split("=").last
      end

      # Reads the kernel module options removing the `mode` option
      #
      # @return [String, nil]
      def read_options
        options = section.bonding_module_opts.to_s
        return nil if options.empty?

        options.gsub(/mode=\S+\ ?/, "")
      end
    end
  end
end
