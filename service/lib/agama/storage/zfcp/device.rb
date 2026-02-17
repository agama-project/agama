# frozen_string_literal: true

# Copyright (c) [2023-2026] SUSE LLC
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

require "yast2/equatable"

module Agama
  module Storage
    module ZFCP
      # zFCP device.
      class Device
        include Yast2::Equatable

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

        # Device name.
        #
        # @return [String, nil] e.g., "/dev/sda", nil if no active yet.
        attr_accessor :device_name

        # Whether the LUN is active.
        #
        # @return [Boolean]
        attr_writer :active

        eql_attr :device_name, :channel, :wwpn, :lun

        # @param channel [String]
        # @param wwpn [String]
        # @param lun [String]
        def initialize(channel, wwpn, lun)
          @channel = channel
          @wwpn = wwpn
          @lun = lun
          @active = false
        end

        # @return [Boolean]
        def active?
          @active
        end
      end
    end
  end
end
