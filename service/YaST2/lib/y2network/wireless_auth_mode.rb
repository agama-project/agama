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

# Vendored from yast2-network's network/src/lib/y2network/wireless_auth_mode.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-network`
# RPM is no longer a runtime dependency of Agama.

require "yast"

module Y2Network
  # This enum-like class represents the wireless authentication modes
  #
  # @todo Use this class whenever one of these symbols is used: :none, :open, :shared,
  # :psk, :eap.
  class WirelessAuthMode
    extend Yast::I18n
    include Yast::I18n

    class << self
      # Returns all the existing modes
      #
      # @return [Array<WirelessAuthMode>] Wireless authentication modes
      def all
        @all ||= WirelessAuthMode.constants
          .map { |c| WirelessAuthMode.const_get(c) }
          .select { |c| c.is_a?(WirelessAuthMode) }
      end

      # Returns the auth mode with the given short name
      #
      # @param short_name [String] Short name
      # @return [WirelessAuthMode,nil] Authentication mode or nil if not found
      def from_short_name(short_name)
        all.find { |t| t.short_name == short_name }
      end
    end

    # @!attribute [r] name
    #   @return [String] Wireless authentication mode name
    # @!attribute [r] short_name
    #   @return [String] Wireless mode short name (to be used in configuration files)
    attr_reader :name, :short_name

    # Constructor
    #
    # @param name [String] Wireless mode name
    # @param short_name [String] Wireles mode short name (e.g., "none")
    def initialize(name, short_name)
      textdomain "network"
      @name = name
      @short_name = short_name
    end

    # Returns the translated name
    #
    # @return [String]
    def to_human_string
      _(name)
    end

    # Returns the symbol representation
    #
    # @return [Symbol]
    def to_sym
      short_name.to_sym
    end

    NONE = new(N_("No Encryption"), "none")
    WEP_OPEN = new(N_("WEP - Open"), "open")
    WEP_SHARED = new(N_("WEP - Shared Key"), "shared")
    WPA_PSK = new(N_("WPA-PSK (\"home\")"), "psk")
    WPA_EAP = new(N_("WPA-EAP (\"enterprise\")"), "eap")
  end
end
