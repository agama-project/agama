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

require "yast"
require "y2storage/planned/device"
require "y2storage/planned/mixins"
require "y2storage/match_volume_spec"
require "y2storage/filesystems/type"

module Y2Storage
  module Planned
    # Specification for a Y2Storage::Filesystems::Btrfs object to be created during the AutoYaST proposal
    #
    # @see Device
    class Btrfs < Device
      include Planned::CanBeFormatted
      include Planned::CanBeMounted
      include MatchVolumeSpec

      # @return [String] name to indenfity this filesystem in the AutoYaST profile
      attr_reader :name

      # @return [String] data RAID level of the multi-device Btrfs
      attr_accessor :data_raid_level

      # @return [String] metadata RAID level of the multi-device Btrfs
      attr_accessor :metadata_raid_level

      # Constructor
      #
      # @param name [String] name to identify this filesystem in the AutoYaST profile
      def initialize(name)
        super()

        initialize_can_be_formatted
        initialize_can_be_mounted

        @name = name
      end

      # Filesystem type is forced to Btrfs
      #
      # @return [Filesystems::Type]
      def filesystem_type
        Filesystems::Type::BTRFS
      end

      # @see Planned::Device#reuse!
      #
      # @param filesystem [Y2Storage::Filesystems::Btrfs]
      def reuse_device!(filesystem)
        assign_mount_point(filesystem)
        setup_fstab_options(filesystem.mount_point)
      end

      # @return [Array<Symbol>]
      def self.to_string_attrs
        [:mount_point, :subvolumes]
      end

      protected

      # Values for volume specification matching
      #
      # @see MatchVolumeSpec
      def volume_match_values
        {
          mount_point:  mount_point,
          size:         nil,
          fs_type:      filesystem_type,
          partition_id: nil
        }
      end
    end
  end
end
