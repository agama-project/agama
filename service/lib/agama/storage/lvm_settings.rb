# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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
    # Settings regarding LVM for the Agama storage proposal
    class LvmSettings
      # Whether to use LVM
      #
      # @return [Boolean]
      attr_accessor :enabled
      alias_method :enabled?, :enabled

      # Devices to use for creating the physical volumes of the system LVM volume group.
      #
      # If a VG is reused (see {#reused_vg}), then the devices are used for extending the VG if
      # needed.
      #
      # @return [Array<String>]
      attr_accessor :system_vg_devices

      # Name of reused VG for allocating the new LVs.
      #
      # @return [String, nil]
      attr_accessor :reused_vg

      def initialize
        @enabled = false
        @system_vg_devices = []
      end
    end
  end
end
