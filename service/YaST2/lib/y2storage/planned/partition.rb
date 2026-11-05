# Copyright (c) [2015-2019] SUSE LLC
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
    # Specification for a Y2Storage::Partition object to be created during the
    # storage or AutoYaST proposals
    #
    # @see Device
    class Partition < Device
      include Planned::HasSize
      include Planned::CanBeFormatted
      include Planned::CanBeResized
      include Planned::CanBeMounted
      include Planned::CanBeEncrypted
      include Planned::CanBePv
      include Planned::CanBeMdMember
      include Planned::CanBeBcacheMember
      include Planned::CanBeBtrfsMember
      include MatchVolumeSpec

      # @return [PartitionId] id of the partition. If nil, the final id is
      #   expected to be inferred from the filesystem type.
      attr_accessor :partition_id

      # @return [String, nil] device name of the disk in which the partition has
      #   to be located. If nil, the volume can be allocated in any disk.
      attr_accessor :disk

      # @return [DiskSize] maximum distance from the start of the disk in which
      #   the partition can start
      attr_accessor :max_start_offset

      # @return [Boolean] whether the boot flag should be set. Expected to be
      #   used only with ms-dos style partition tables. GPT has a similar legacy
      #   flag but is not needed in our grub2 setup.
      attr_accessor :bootable

      # @return [Boolean] whether the partition must be primary
      attr_accessor :primary

      # @return [PartitionTables::Type, nil] type of the partition table. If nil,
      #   the partition will be created in any available partition table. If this
      #   is set to a particular type and {#disk} points to any device, the
      #   proposal must ensure that such device contains a partition table of
      #   the given type.
      attr_accessor :ptable_type

      # Constructor.
      #
      # @param mount_point [string] See {#mount_point}
      # @param filesystem_type [Filesystems::Type] See {#filesystem_type}
      def initialize(mount_point, filesystem_type = nil)
        super()
        initialize_has_size
        initialize_can_be_formatted
        initialize_can_be_mounted
        initialize_can_be_encrypted
        initialize_can_be_pv
        initialize_can_be_md_member
        initialize_can_be_bcache_member
        initialize_can_be_btrfs_member

        @mount_point = mount_point
        @filesystem_type = filesystem_type
        @primary = false
      end

      # Whether this corresponds to a reused partition that is located right before the given
      # assigned space
      #
      # @param assigned_space [AssignedSpace]
      # @return [Boolean]
      def subsequent_slot?(assigned_space)
        devicegraph = assigned_space.disk_space.disk.devicegraph
        dev = device_to_reuse(devicegraph)
        return false unless dev

        dev.subsequent_slot?(assigned_space.disk_space)
      end

      def self.to_string_attrs
        [
          :mount_point, :reuse_name, :reuse_sid, :min_size, :max_size,
          :disk, :max_start_offset, :subvolumes
        ]
      end

      protected

      # Values for volume specification matching
      #
      # @see MatchVolumeSpec
      def volume_match_values
        {
          mount_point:  mount_point,
          size:         min_size,
          fs_type:      filesystem_type,
          partition_id: partition_id
        }
      end

      def reuse_device!(device)
        super
        device.boot = true if bootable && device.respond_to?(:boot=)
      end
    end
  end
end
