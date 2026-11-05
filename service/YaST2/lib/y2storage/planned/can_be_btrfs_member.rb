# Copyright (c) [2019] SUSE LLC
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

module Y2Storage
  module Planned
    # Mixin for planned devices that can be part of a multi-device Btrfs
    # @see Planned::Device
    module CanBeBtrfsMember
      # @return [String] name of the multi-device Btrfs to which this device should be added
      attr_accessor :btrfs_name

      # Initializations of the mixin, to be called from the class constructor.
      def initialize_can_be_btrfs_member; end

      # Checks whether the device represents a Btrfs member
      #
      # @return [Boolean]
      def btrfs_member?
        !btrfs_name.nil?
      end

      # @see Planned::Device#component?
      #
      # @return [Boolean]
      def component?
        super || btrfs_member?
      end
    end
  end
end
