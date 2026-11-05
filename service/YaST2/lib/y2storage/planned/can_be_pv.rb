# Copyright (c) [2017-2019] SUSE LLC
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

module Y2Storage
  module Planned
    # Mixin for planned devices that can act as LVM physical volume
    # @see Planned::Device
    module CanBePv
      # @return [String] name of the LVM volume group for which this device
      #   should be used as physical volume
      attr_accessor :lvm_volume_group_name

      # Initializations of the mixin, to be called from the class constructor.
      def initialize_can_be_pv; end

      # Checks whether the device represents an LVM physical volume
      #
      # @return [Boolean]
      def lvm_pv?
        !lvm_volume_group_name.nil?
      end

      # Checks whether the device represents an LVM physical volume of the given
      # volume group.
      #
      # @param vg_name [String] name of the volume group
      # @return [Boolean]
      def pv_for?(vg_name)
        lvm_volume_group_name == vg_name
      end

      # @see Planned::Device#component?
      #
      # @return [Boolean]
      def component?
        super || lvm_pv?
      end
    end
  end
end
