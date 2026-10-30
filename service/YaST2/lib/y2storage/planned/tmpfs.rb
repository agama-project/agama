# Copyright (c) [2020] SUSE LLC
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
require "y2storage/planned/device"
require "y2storage/planned/mixins"
require "y2storage/match_volume_spec"
require "y2storage/filesystems/type"

module Y2Storage
  module Planned
    # Specification for a Y2Storage::Filesystems::Tmpfs object to be created during the AutoYaST proposal
    #
    # @see Device
    class Tmpfs < Device
      include Planned::CanBeMounted
      include MatchVolumeSpec

      # Constructor
      #
      # @param mount_point [String] mount path for this filesystem in the AutoYaST profile
      # @param fstab_options [Array<String>] fstab options for this filesystem in the AutoYaST profile
      def initialize(mount_point, fstab_options)
        super()

        initialize_can_be_mounted

        self.mount_point = mount_point
        self.fstab_options = fstab_options
      end

      # @return [Array<Symbol>]
      def self.to_string_attrs
        [:mount_point]
      end

      protected

      # Values for volume specification matching
      #
      # @see MatchVolumeSpec
      def volume_match_values
        {
          mount_point:  mount_point,
          size:         nil,
          fs_type:      Filesystems::Type::TMPFS,
          partition_id: nil
        }
      end
    end
  end
end
