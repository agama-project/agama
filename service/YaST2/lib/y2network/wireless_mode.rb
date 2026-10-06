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

# Vendored from yast2-network's network/src/lib/y2network/wireless_mode.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-network`
# RPM is no longer a runtime dependency of Agama.

require "yast"

module Y2Network
  class WirelessMode
    extend Yast::I18n
    include Yast::I18n

    class << self
      # Returns all the existing modes
      #
      # @return [Array<WirelessMode>] Wireless modes
      def all
        @all ||= WirelessMode.constants
          .map { |c| WirelessMode.const_get(c) }
          .select { |c| c.is_a?(WirelessMode) }
      end
    end

    # @!attribute [r] name
    #   @return [String] Wireless mode name
    # @!attribute [r] short_name
    #   @return [String] Wireless mode short name (to be used in configuration files)
    attr_reader :name, :short_name

    # Constructor
    #
    # @param name [String] Wireless mode name
    # @param short_name [String] Wireles mode short name (e.g., "ad-hoc")
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

    AD_HOC = new(N_("Add-hoc"), "ad-hoc")
    MANAGED = new(N_("Managed"), "managed")
    MASTER = new(N_("Master"), "master")
  end
end
