# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
      # zFCP disk
      class Disk
        # Device name
        #
        # @return [String] e.g., "/dev/sda"
        attr_reader :name

        # zFCP controller channel id
        #
        # @return [String]
        attr_reader :channel

        # zFCP WWPN
        #
        # @return [String]
        attr_reader :wwpn

        # zFCP LUN
        #
        # @return [String]
        attr_reader :lun

        # Constructor
        #
        # @param name [String]
        # @param channel [String]
        # @param wwpn [String]
        # @param lun [String]
        def initialize(name, channel, wwpn, lun)
          @name = name
          @channel = channel
          @wwpn = wwpn
          @lun = lun
        end
      end
    end
  end
end
