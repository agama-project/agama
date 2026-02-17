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
  module Storage
    module ZFCP
      # zFCP config.
      class Config
        # List of devices.
        #
        # @return [Array<Configs::Device>]
        attr_accessor :devices

        def initialize
          @devices = []
        end

        # Whether the config includes a device with the given channel, WWPN and LUN.
        #
        # @param channel [String]
        # @param wwpn [String]
        # @param lun [String]
        #
        # @return [Boolean]
        def include_device?(channel, wwpn, lun)
          !find_device(channel, wwpn, lun).nil?
        end

        # Searchs for a device with the given channel, WWPN and LUN.
        #
        # @param channel [String]
        # @param wwpn [String]
        # @param lun [String]
        #
        # @return [Configs::Device, nil]
        def find_device(channel, wwpn, lun)
          devices.find { |d| d.channel == channel && d.wwpn == wwpn && d.lun == lun }
        end
      end
    end
  end
end
