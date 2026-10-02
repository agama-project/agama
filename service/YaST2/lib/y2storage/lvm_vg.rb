# Copyright (c) [2017-2021] SUSE LLC
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

require "y2storage/storage_class_wrapper"
require "y2storage/device"
require "y2storage/comparable_by_name"

module Y2Storage
  # A Volume Group of the Logical Volume Manager (LVM)
  #
  # This is a wrapper for Storage::LvmVg
  class LvmVg < Device
    wrap_class Storage::LvmVg

    include ComparableByName

    # @!attribute vg_name
    #   @return [String] volume group name (e.g."vg0"), not to be confused
    #     with BlkDevice#name (e.g. "/dev/mapper/vg0")
    storage_forward :vg_name
    storage_forward :vg_name=

    # @!method size
    #   @return [DiskSize]
    storage_forward :size, as: "DiskSize"

    # @!attribute extent_size
    #   Size of one extent
    #
    #   Each logical volume is split into chunks of data, known as logical
    #   extents. The extent size is the same for all logical volumes in the
    #   volume group.
    #
    #   Setting the extent_size can modify the size of the logical volumes.
    #
    #   @raise Storage::InvalidExtentSize
    #
    #   @return [DiskSize]
    storage_forward :extent_size, as: "DiskSize"
    storage_forward :extent_size=

    # @!method number_of_extents
    #   Total number of extents
    #   @see #extent_size
    #
    #   @return [Integer] total number of extents
    storage_forward :number_of_extents

    # @!method number_of_used_extents
    #   Total number of extents currently in use. May be larger than the number
    #   of extents in the volume group.
    #   @see #extent_size
    #
    #   @return [Integer]
    storage_forward :number_of_used_extents

    # @!method number_of_free_extents
    #   Total number of available extents
    #   @see #extent_size
    #
    #   @return [Integer]
    storage_forward :number_of_free_extents

    # @!method lvm_pvs
    #   @return [Array<LvmPv>] physical volumes in the VG
    storage_forward :lvm_pvs, as: "LvmPv"

    # @!method add_lvm_pv(blk_device)
    #   Adds a block device as a physical volume to the volume group. If there
    #   is not a physical volume on the block device it will be created.
    #
    #   @param blk_device [BlkDevice]
    #   @return [LvmPv]
    storage_forward :add_lvm_pv, as: "LvmPv"

    # @!method remove_lvm_pv(blk_device)
    #   Removes a block device from the volume group. The physical volume on the
    #   block device will the deleted.
    #
    #   @param blk_device [BlkDevice]
    storage_forward :remove_lvm_pv

    # @!method lvm_lvs
    #   Returns the logical volumes in the VG, in no particular order.
    #
    #   @note Thin volumes are actually created over a thin pool volume. This method
    #     includes all thin pools but not their thin volumes.
    #
    #   @return [Array<LvmLv>]
    storage_forward :lvm_lvs, as: "LvmLv"

    # @!method create_lvm_lv(lv_name, lv_type, size)
    #   Creates a logical volume with name lv_name and type lv_type in the volume group.
    #
    #   @param lv_name [String] name of the new volume (see {LvmLv#lv_name})
    #   @param lv_type [LvType] type of the new volume
    #   @param size [DiskSize] size of the new volume
    #   @return [LvmLv]
    storage_forward :create_lvm_lv, as: "LvmLv"

    storage_forward :storage_delete_lvm_lv, to: :delete_lvm_lv
    private :storage_delete_lvm_lv

    # Deletes a logical volume in the volume group. Also deletes all
    # descendants of the logical volume.
    #
    # @param lv [LvmLv] volume to delete
    def delete_lvm_lv(lv)
      # Needed to enforce the REMOVE view when deleting descendants
      lv.remove_descendants

      storage_delete_lvm_lv(lv)
    end

    # @!method max_size_for_lvm_lv(lv_type)
    #   Returns the max size for a new logical volume of type lv_type. The size may
    #   be limited by other parameters  (e.g. the filesystem on it). The max size also
    #   depends on parameters like the chunk size for thin pools.
    #
    #   @param lv_type [LvType]
    #   @return [DiskSize]
    storage_forward :max_size_for_lvm_lv, as: "DiskSize"

    # @!method overcommitted?
    #   Checks whether the volume group is overcommitted. If it is, StorageManager#commit
    #   will most likely fail.
    #
    #   @return [Boolean]
    storage_forward :overcommitted?

    # @!method self.create(devicegraph, vg_name)
    #   @param devicegraph [Devicegraph]
    #   @param vg_name [String] See {#vg_name}
    #   @return [LvmVg]
    storage_class_forward :create, as: "LvmVg"

    # @!method self.all(devicegraph)
    #   @param devicegraph [Devicegraph]
    #   @return [Array<LvmVg>] all the volume groups in the given devicegraph,
    #     sorted by #vg_name
    storage_class_forward :all, as: "LvmVg"

    # @!method self.find_by_vg_name(devicegraph, vg_name)
    #   @param devicegraph [Devicegraph]
    #   @param vg_name [String] name of the volume group. See {#vg_name}
    #   @return [LvmVg] nil if there is no such volume group
    storage_class_forward :find_by_vg_name, as: "LvmVg"

    # Determines the available space on the volume group
    #
    # @return [DiskSize] Available space in the volume group
    def available_space
      extent_size * number_of_free_extents
    end

    # Determines the total size of the volume group
    #
    # @return [DiskSize] Size of the volume group
    def total_size
      extent_size * number_of_extents
    end

    # mimics BlkDevice API. Gets name as "/dev/#{vg_name}.
    # @return [String]
    def name
      "/dev/#{vg_name}"
    end

    # Returns all logical volumes in the volume group,
    # including thin volumes (see #lvm_lvs)
    #
    # @return [Array<LvmLv>]
    def all_lvm_lvs
      lvm_lvs.reduce([]) do |lvs, lv|
        lvs << lv
        lvs.concat(lv.lvm_lvs)
      end
    end

    # Returns all thin pools in the volume group
    #
    # @return [Array<LvmLv>]
    def thin_pool_lvm_lvs
      lvm_lvs.select { |lv| lv.is?(:lvm_thin_pool) }
    end

    # Returns all thin volumes in the volume group
    #
    # @return [Array<LvmLv>]
    def thin_lvm_lvs
      thin_pool_lvm_lvs.map(&:lvm_lvs).flatten
    end

    alias_method :basename, :vg_name

    # @see Device#potential_orphans
    #
    # @return [Array<Device>]
    def potential_orphans
      lvm_pvs
    end

    # Maximum size for a striped logical volume
    #
    # @see #pv_size_for_striped_lv
    #
    # @param stripes [Integer] number of stripes. It must be bigger than 1
    # @raise [ArgumentError] @see #pv_size_for_striped_lv
    # @return [DiskSize, nil] nil if no enough physical volumes for the given number of stripes
    def max_size_for_striped_lv(stripes)
      pv_size = pv_size_for_striped_lv(stripes)

      return nil unless pv_size

      pv_size * stripes
    end

    # Whether the volume group has enough size to allocate a striped logical volume
    #
    # Note that for allocating a striped volume, the volume group must have as many physical volumes as
    # the number of required stripes. Moreover, the physical volumes should be big enough to allocate
    # the required size.
    #
    # @see #pv_size_for_striped_lv
    #
    # @param size [DiskSize] required size for the striped volume
    # @param stripes [Integer] number of stripes. It must be bigger than 1
    # @raise [ArgumentError] @see #pv_size_for_striped_lv
    # @return [Boolean]
    def size_for_striped_lv?(size, stripes)
      pv_size = pv_size_for_striped_lv(stripes)

      return false unless pv_size

      required_pv_size = size / stripes

      pv_size >= required_pv_size
    end

    # Usable size of the physical volume that limits the maximum size of a new striped logical volume
    #
    # The maximum size of a striped logical volume is limited by the n-th physical volume with biggest
    # usable size. For example, let's say we have a volume group with 3 physical volumes with the
    # following usable sizes: pv1 (2 GiB), pv2 (50 GiB) and pv3 (1 GiB). For a striped volume with 2
    # stripes, the second physical volume (pv1) restricts its maximum size. In this case, the maximum
    # size would be: 2 (stripes) * 2 GiB (pv1 usable size) = 4 GiB. If the number of stripes is 3, then
    # the maximum size is limited by the third physical volume with biggest usable size (pv3), so the
    # maximum size would be: 3 (stripes) * 1 GiB (pv3 usable size) = 3 GiB.
    #
    # @param stripes [Integer] number of stripes. It must be bigger than 1
    # @raise [ArgumentError] when the given number of stripes is incorrect (i.e., less than 1)
    # @return [DiskSize, nil] nil if no enough physical volumes for the given number of stripes
    def pv_size_for_striped_lv(stripes)
      raise(ArgumentError, "stripes must be bigger than 1") unless stripes > 1

      return nil if stripes > lvm_pvs.size

      lvm_pvs.map(&:usable_size).sort[-stripes]
    end

    protected

    # @see Device#is?
    def types_for_is
      super << :lvm_vg
    end
  end
end
