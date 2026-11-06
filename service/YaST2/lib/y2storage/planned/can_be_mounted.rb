# Copyright (c) [2015-2017] SUSE LLC
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
require "y2storage/btrfs_subvolume"

module Y2Storage
  module Planned
    # Mixin for planned devices that can have a mount point.
    # @see Planned::Device
    module CanBeMounted
      # @return [String] mount point for this planned device. This might be a
      #   real mount point ("/", "/boot", "/home") or a pseudo mount point like
      #   "swap".
      attr_accessor :mount_point

      # @return [Y2Storage::MountByType]
      attr_accessor :mount_by

      # @return [Array<String>]
      attr_accessor :fstab_options

      # @return [Boolean]
      attr_accessor :read_only

      # Initializations of the mixin, to be called from the class constructor.
      def initialize_can_be_mounted
        @read_only = false
      end

      # Whether the device will be mounted as root
      # @return [Boolean]
      def root?
        mount_point == MountPoint::ROOT_PATH.to_s
      end

      # Whether the device will be mounted as swap
      # @return [Boolean]
      def swap?
        mount_point == MountPoint::SWAP_PATH.to_s
      end
    end
  end
end
