# Copyright (c) [2018-2019] SUSE LLC
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

module Y2Storage
  module Planned
    # Specification for a Y2Storage::Disk object to be used suring the storage
    # or AutoYaST proposals
    #
    # @see Device
    class Disk < Device
      include Planned::CanBeFormatted
      include Planned::CanBeMounted
      include Planned::CanBeEncrypted
      include Planned::CanBePv
      include Planned::CanBeMdMember
      include Planned::CanBeBcacheMember
      include Planned::CanBeBtrfsMember
      include MatchVolumeSpec

      # @return [Array<Planned::Partition>] List of planned partitions
      attr_accessor :partitions

      # Constructor
      def initialize
        super()
        initialize_can_be_formatted
        initialize_can_be_mounted
        initialize_can_be_encrypted
        initialize_can_be_pv
        initialize_can_be_md_member
        initialize_can_be_bcache_member
        initialize_can_be_btrfs_member

        @partitions = []
      end

      def self.to_string_attrs
        [
          :mount_point, :reuse_name, :reuse_sid, :subvolumes
        ]
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
