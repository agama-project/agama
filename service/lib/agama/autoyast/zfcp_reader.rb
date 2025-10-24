# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
    # Builds the Agama "zfcp" section from an AutoYaST profile.
    class ZFCPReader
      # @param profile [ProfileHash] AutoYaST profile
      def initialize(profile)
        @profile = profile
      end

      # Returns a hash that corresponds to Agama "zfcp" section.
      #
      # @return [Hash] Agama "zfcp" section
      def read
        devices = profile.fetch_as_hash("zfcp").fetch_as_array("devices")
        return {} if devices.empty?

        zfcp_devices = devices.map do |device|
          {
            "channel" => device["controller_id"],
            "wwpn"    => device["wwpn"],
            "lun"     => device["lun"]
          }
        end

        { "zfcp" => {
          "devices" => zfcp_devices
        } }
      end

    private

      attr_reader :profile
    end
  end
end
