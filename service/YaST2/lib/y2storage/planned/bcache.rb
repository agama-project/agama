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

module Y2Storage
  module Planned
    # Specification for a Y2Storage::Bcache object to be created during the proposal
    #
    # @see Device
    class Bcache < Device
      include Planned::CanBeFormatted
      include Planned::CanBeMounted
      include Planned::CanBeEncrypted
      include MatchVolumeSpec

      # @return [String] tentative device name of the bcache
      attr_accessor :name

      # @return [Y2Storage::PartitionTables::Type] Partition table type
      attr_accessor :ptable_type

      # @return [Array<Planned::Partition>] List of planned partitions
      attr_accessor :partitions

      # @return [Y2Storage::CacheMode] bcache cache mode
      attr_accessor :cache_mode

      def initialize(name: nil)
        super()
        self.name = name
        initialize_can_be_formatted
        initialize_can_be_mounted
        initialize_can_be_encrypted
        @partitions = []
      end

      def self.to_string_attrs
        [:mount_point, :reuse_name, :name, :subvolumes]
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
