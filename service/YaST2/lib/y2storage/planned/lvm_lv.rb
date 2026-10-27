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
    # Specification for a Y2Storage::LvmLv object to be created during the
    # storage or AutoYaST proposals
    #
    # @see Device
    class LvmLv < Device
      include Planned::HasSize
      include Planned::CanBeFormatted
      include Planned::CanBeResized
      include Planned::CanBeMounted
      include Planned::CanBeEncrypted
      include Planned::CanBeBcacheMember
      include Planned::CanBeBtrfsMember
      include MatchVolumeSpec

      # @return [String] name to use for Y2Storage::LvmLv#lv_name
      attr_accessor :logical_volume_name

      # @return [LvType] Logical volume type
      attr_accessor :lv_type

      # @return [Array<LvmLv>] List of thin logical volumes (when LvType::THIN_POOL)
      attr_reader :thin_lvs

      # @return [LvmLv] Thin pool where the logical volumes belongs to (when LvType::THIN)
      attr_accessor :thin_pool

      # @return [DiskSize] Stripe size
      attr_accessor :stripe_size

      # @return [Integer] Number of stripes
      attr_accessor :stripes

      # @return [String, nil] device name of the disk (or DiskDevice, to be precise) in which
      #   the LV has to be located. If nil, the volume can be allocated in any set of disks.
      attr_accessor :disk

      # Builds a new object based on a real LvmLv one
      #
      # The new instance represents the intention to reuse the real LV, so the
      # #reuse_name method will be set accordingly. On the other hand, it copies
      # information from the real LV to make sure it is available even if the
      # real object disappears.
      #
      # @param real_lv [Y2Storage::LvmLv] Logical volume to get the values from
      # @return [LvmLv] New LvmLv instance based on real_lv
      def self.from_real_lv(real_lv)
        lv = new(real_lv.filesystem_mountpoint, real_lv.filesystem_type)
        lv.initialize_from_real_lv(real_lv)
        lv
      end

      # Constructor.
      #
      # @param mount_point [string] See {CanBeMounted#mount_point}
      # @param filesystem_type [Filesystems::Type] See {CanBeFormatted#filesystem_type}
      def initialize(mount_point, filesystem_type = nil)
        super()
        initialize_has_size
        initialize_can_be_formatted
        initialize_can_be_mounted
        initialize_can_be_encrypted
        initialize_can_be_bcache_member
        initialize_can_be_btrfs_member

        @mount_point = mount_point
        @filesystem_type = filesystem_type
        @lv_type = LvType::NORMAL
        @thin_lvs = []

        @logical_volume_name =
          if root?
            "root"
          elsif swap?
            "swap"
          elsif @mount_point&.start_with?("/")
            lv_name = @mount_point.sub(%r{^/}, "")
            lv_name.tr("/", "_")
          end
      end

      # Initializes the object taking the values from a real logical volume
      #
      # @param real_lv [Y2Storage::LvmLv] Logical volume to get the values from
      def initialize_from_real_lv(real_lv)
        @logical_volume_name = real_lv.lv_name
        self.reuse_name = real_lv.lv_name
      end

      # Returns the size for the logical volume in a given volume group/thin pool
      #
      # * If size is specified as a percentage, it calculates the size using
      #   the container size as reference.
      # * If it is a thin volume, it returns max size. If it is unlimited,
      #   the thin pool size will be returned.
      # * Otherwise, the planned size (Planned::LvmLv#size) is returned.
      #
      # @param container [LvmVg,LvmLv] Volume group or thin pool where the
      #   logical volume will be placed
      # @return [DiskSize]
      def size_in(container)
        return size_in_percentage(container) if percent_size
        return size_in_thin_pool(container) if lv_type == LvType::THIN

        size
      end

      # Returns the real size for the logical volume in a given volume group/thin pool
      #
      # When dealing with thin pools, some space is reserved for metadata. This method
      # returns an adjusted planned size taking the available space for the given
      # lv_type into account.
      #
      # @param container [LvmVg,LvmLv] Volume group or thin pool where the
      #   logical volume will be placed
      # @return [DiskSize]
      def real_size_in(container)
        [size_in(container), container.max_size_for_lvm_lv(lv_type)].min
      end

      # It adds a thin logical volume
      #
      # To be used when lv_type is LvType::THIN_POOL
      #
      # @param lv [Planned::LvmLv] Planned logical volume
      def add_thin_lv(lv)
        raise ArgumentError unless lv.lv_type == LvType::THIN

        lv.thin_pool = self
        thin_lvs << lv
      end

      def self.to_string_attrs
        [:mount_point, :reuse_name, :min_size, :max_size, :disk,
         :logical_volume_name, :subvolumes]
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
          partition_id: nil
        }
      end

      # Returns the size for the LV in a given volume group/thin pool when specified as percentage
      #
      # @param container [LvmVg,LvmLv] Volume group or thin pool where the logical volume will
      #   be placed
      # @return [DiskSize]
      def size_in_percentage(container)
        extent_size = container.is?(:lvm_lv) ? container.lvm_vg.extent_size : container.extent_size
        (container.size * percent_size / 100).floor(extent_size)
      end

      # Returns the size for the logical volume in a given thin pool
      #
      # @param thin_pool [LvmVg,LvmLv] Volume group or thin pool where the logical volume will
      #   be placed
      # @return [DiskSize]
      def size_in_thin_pool(thin_pool)
        max.unlimited? ? thin_pool.size : max
      end
    end
  end
end
