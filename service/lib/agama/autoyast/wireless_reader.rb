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
    # Builds an Agama "wireless" section from an AutoYaST InterfaceSection.
    class WirelessReader
      # @param section [Y2Network::AutoinstProfile::InterfaceSection] Interface section
      def initialize(section)
        @section = section
      end

      # Returns a hash that corresponds to Agama's "wireless" section
      #
      # If there is no wireless information, it returns an empty hash.
      #
      # @return [Hash]
      def read
        wireless = {}
        security = security_from(section.wireless_auth_mode)
        wireless["security"] = security if security
        mode = mode_from(section.wireless_mode)
        wireless["mode"] = mode if mode
        wireless["ssid"] = section.wireless_essid.to_s

        case security
        when "wpa-psk"
          wireless["password"] = section.wireless_wpa_psk.to_s
        when "wpa-eap"
          wireless["password"] = section.wireless_wpa_password.to_s
        end

        return {} if wireless.empty?

        { "wireless" => wireless }
      end

    private

      attr_reader :section

      # Returns the security protocol according to the given WirelessAuthMode
      #
      # @param auth_mode [String] Name of the YaST's wireless authentication mode
      # @return [String, nil] Name of Agama's security protocol
      def security_from(auth_mode)
        case auth_mode
        when Y2Network::WirelessAuthMode::WPA_PSK
          "wpa-psk"
        when Y2Network::WirelessAuthMode::WPA_EAP
          "wpa-eap"
        else
          "none"
        end
      end

      # Returns the wireless mode according to the given WirelessMode
      #
      # @param mode [Y2Network::WirelessMode] YaST's wireless mode
      # @return [String, nil] Name of Agama's wireless mode
      def mode_from(mode)
        case mode
        when Y2Network::WirelessMode::AD_HOC
          "adhoc"
        when Y2Network::WirelessMode::MASTER
          "ap"
        when Y2Network::WirelessMode::MANAGED
          "infrastructure"
        end
      end
    end
  end
end
