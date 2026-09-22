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

module Agama
  module Storage
    module ZFCP
      # zFCP device.
      #
      # [ Mainframe Linux ]
      #          │
      #          ▼ (Channel: e.g., 0.0.1700)
      # ┌─────────────────┐
      # │ zFCP Host Port  │
      # └─────────────────┘
      #          │
      #          ▼ (WWPN: e.g., 0x5005076303030123)
      # ┌─────────────────┐
      # │ Storage Array   │
      # └─────────────────┘
      #          │
      #          ▼ (LUN: e.g., 0x4010400000000000)
      # ┌─────────────────┐
      # │  Disk Volume    │ ──► Presented to Linux as /dev/sda
      # └─────────────────┘
      class Device
        # The Channel represents the physical and virtual I/O hardware interface on the mainframe
        # (e.g., "0.0.1700").
        #
        # @return [String]
        attr_reader :channel

        # The WWPN is a unique 64-bit address (represented as a 16-character hexadecimal string)
        # assigned to a Fibre Channel port (e.g., "0x5005076303030123").
        #
        # @return [String]
        attr_reader :wwpn

        # The LUN is an 18-character hexadecimal identifier that represents an individual logical
        # disk volume carved out on the storage array (e.g., "0x4010400000000000").
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

        # @return [String]
        def to_s
          "#{channel} #{wwpn} #{lun}"
        end
      end
    end
  end
end
