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
require "y2storage/blk_device"

module Y2Storage
  # A logical volume of the Logical Volume Manager (LVM)
  #
  # This is a wrapper for Storage::LvmLv
  class LvmLv < BlkDevice
    wrap_class Storage::LvmLv

    # @!method lv_name
    #   @return [String] logical volume name (e.g. "lv1"), not to be confused
    #     with BlkDevice#name (e.g. "/dev/mapper/vg0/lv1")
    storage_forward :lv_name

    # @see BlkDevice#stable_name?
    #
    # The name is based on {#lv_name} and {LvmVg#vg_name}. Since both are
    # stable, the name should not change across reboots.
    #
    # @return [Boolean]
    def stable_name?
      true
    end

    # @!method lvm_vg
    #   @return [LvmVg] volume group the LV belongs to
    storage_forward :lvm_vg, as: "LvmVg"

    # @see #thin_pool
    storage_forward :storage_thin_pool, to: :thin_pool, as: "LvmLv"
    private :storage_thin_pool

    # @!method lv_type
    #   @return [LvType] type of the logical volume
    storage_forward :lv_type, as: "LvType"

    # @see #stripes
    storage_forward :storage_stripes, to: :stripes
    private :storage_stripes

    # @!method stripes=(num_stripes)
    #   Sets the number of stripes. The size of the LV must be a multiple of
    #   the number of stripes and the stripe size. Thin LVs cannot be striped.
    #
    #   @param num_stripes [Integer]
    #   @raise [Storage::Exception] if the number of stripes is invalid
    #     (i.e., bigger than 128)
    storage_forward :stripes=

    # @see #stripe_size
    storage_forward :storage_stripe_size, to: :stripe_size, as: "DiskSize"
    private :storage_stripe_size

    # @!method stripe_size=(stripe_size)
    #   Sets the size of a stripe
    #
    #   @param stripe_size [DiskSize, Integer]
    storage_forward :stripe_size=

    # @!method max_size_for_lvm_lv(lv_type)
    #   Returns the max size for a new logical volume of type lv_type. The size
    #   may be limited by other parameters (e.g. the filesystem on it).
    #
    #   The max size for thin logical volumes is in general theoretic (max size
    #   that can be represented)
    #
    #   @param lv_type [LvType]
    #   @return [DiskSize]
    storage_forward :max_size_for_lvm_lv, as: "DiskSize"

    # @!method lvm_lvs
    #   Returns the thin volumes over a thin pool, so it only makes sense to be
    #   called over a thin pool volume. For thin and normal logical volumes it
    #   returns an empty list.
    #
    #   @return [Array<LvmLv>] logical volumes in the thin pool, in no particular order
    storage_forward :lvm_lvs, as: "LvmLv"

    # @!method snapshots
    #   Returns the snapshots of a logical volume, if any.
    #
    #   @return [Array<LvmLv>] a collection of snapshots volumes
    storage_forward :snapshots, as: "LvmLv"

    # @!method origin
    #   Returns the original volume of an snapshot.
    #
    #   @return [LvmLv] the original logical volume
    storage_forward :origin, check_with: :has_origin, as: "LvmLv"

    # @!method create_lvm_lv(lv_name, lv_type, size)
    #   Creates a logical volume with name lv_name and type lv_type in the thin pool.
    #   Only supported lv_type is THIN.
    #
    #   @param lv_name [String] name of the new volume (see {LvmLv#lv_name})
    #   @param lv_type [LvType] type of the new volume
    #   @param size [DiskSize] size of the new volume
    #
    #   @raise [Storage::Exception]
    #
    #   @return [LvmLv]
    storage_forward :create_lvm_lv, as: "LvmLv"

    # @!method self.all(devicegraph)
    #   @param devicegraph [Devicegraph]
    #   @return [Array<Disk>] all the logical volumes in the given devicegraph
    storage_class_forward :all, as: "LvmLv"

    # Returns the thin pool holding a thin volume
    #
    # @return [LvmLv] the thin pool when dealing with a thin LV; nil otherwise
    def thin_pool
      lv_type.is?(:thin) ? storage_thin_pool : nil
    end

    # Number of stripes
    #
    # @note it returns the value of Storage::LvmLv#stripes, except for thin volumes that are going
    #   to report the striping defined for their thin pools.
    #
    # @return [Integer] 0 when the LV is not striped; Storage::LvmLv#stripes otherwise
    def stripes
      thin_pool ? thin_pool.stripes : storage_stripes
    end

    # Size of a stripe
    #
    # @note it returns the value of Storage::LvmLv#stripe_size, except for thin volumes that are
    #   going to report the striping size defined for their thin pools.
    #
    # @return [DiskSize]
    def stripe_size
      thin_pool ? thin_pool.stripe_size : storage_stripe_size
    end

    # Whether the logical volume is striped
    #
    # @return [Boolean]
    def striped?
      stripes > 1
    end

    # Whether the thin pool is overcommitted
    #
    # @note Overcommitting means that a thin pool has not enough size to cover
    #   all thin volumes created over the thin pool. In consequence, this method
    #   only makes sense for thin pools. For other logical volumes it always
    #   returns false.
    #
    # @return [Boolean] true if the thin pool is overcommitted; false otherwise.
    def overcommitted?
      return false unless lv_type.is?(:thin_pool)

      size < DiskSize.sum(lvm_lvs.map(&:size))
    end

    # Resizes the volume, taking resizing limits, extent size and stripes into account.
    #
    # It does nothing if resizing is not possible (see {ResizeInfo#resize_ok?}).
    # Otherwise, it sets the size of the LV based on the requested size.
    #
    # If the requested size is out of the min/max limits provided by
    # {#resize_info}, the end will be adjusted to the corresponding limit.
    #
    # If the requested size is between the limits, the size will be set to the
    # closest valid (i.e. divisible by the extent size) value, rounding down if
    # needed.
    #
    # The resulting size is also rounded down according to the number of stripes. In
    # case of setting the minimum possible size, this method does not round the size
    # down in order to avoid sizes below the minimum. Anyway, lvcreate command always
    # tries to round the number of extents up. So, even though the minimum size is not
    # rounded here, it will be correctly rounded by lvcreate.
    #
    # @param new_size [DiskSize] tentative new size of the volume, take into
    #   account that the result may be slightly smaller after rounding it down
    #   based on the extent size
    def resize(new_size)
      log.info "Trying to resize #{name} (#{size}) to #{new_size}"
      return unless can_resize?

      # The sizes in resize_info are already rounded to the extent size
      self.size =
        if new_size > resize_info.max_size
          resize_info.max_size
        elsif new_size < resize_info.min_size
          resize_info.min_size
        else
          new_size
        end

      self.size = rounded_size if size != resize_info.min_size

      log.info "Size of #{name} set to #{size}"
    end

    # Rounded-down size according to the extent size and the number of stripes
    #
    # When a logical volume is created, libstorage-ng calculates the number of extents for the new
    # logical volume. As result, the size is rounded-down to the extent size. But then, lvcreate command
    # rounds up the number of extents to make it multiple of the number of stripes. This could lead to a
    # number of extents that exceeds the total number of extents from the volume group.
    #
    # @return [DiskSize]
    def rounded_size
      return size if size.zero? || !striped?

      extends = size.to_i / lvm_vg.extent_size.to_i
      extends -= (extends % stripes)

      lvm_vg.extent_size * extends
    end

    protected

    # @see Device#is?
    def types_for_is
      types = super
      types << :lvm_lv
      types << :lvm_snapshot if origin
      types << :lvm_thin_snapshot if lv_type.is?(:thin) && origin
      types << "lvm_#{lv_type}".to_sym unless lv_type.is?(:unknown, :normal, :snapshot)
      types
    end
  end
end
