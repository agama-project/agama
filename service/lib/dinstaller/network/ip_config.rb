# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

module DInstaller
  module Network
    # Represents the IP configuration
    class IPConfig < Struct.new("IPConfig", :method, :addresses, :gateway)
      module METHODS
        AUTO = "auto" # DHCP
        STATIC = "static"
      end

      # @!attribute [r] method
      #   @return [String] Configuration method
      #   @see METHODS
      #
      # @!attribute [r]
      #   @return [String] IP Address

      # Determines whether two connection objects are equivalent
      #
      # @param other [IPConfig] Object to compare with
      def ==(other)
        method == other.method && addresses == other.addresses && gateway == other.gateway
      end

      # Returns a hash representation to be used in D-Bus
      #
      # @return [Hash]
      def to_dbus
        {
          "method" => method,
          "addresses" => addresses,
          "gateway" => gateway.to_s
        }
      end
    end
  end
end
