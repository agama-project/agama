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

require "y2storage/storage_class_wrapper"
require "y2storage/disk_size"

module Y2Storage
  # A qgroup of a Btrfs filesystem
  #
  # This is a wrapper for Storage::BtrfsQgroup.
  #
  # In Btrfs, the qgroups hold the quota information for a given set of subvolumes.
  # Although they can be organized in a tree hierarchy, we are only considering the
  # first level (level 0, actually), so they are associated to a single subvolume.
  #
  # @see man btrfs-quota
  # @see man btrfs-qgroup
  class BtrfsQgroup < Device
    wrap_class Storage::BtrfsQgroup

    storage_forward :storage_id, to: :id
    private :storage_id

    # Id of the group including the level and the qgroup id
    #
    # For qgroups of level 0, the second term (the qgroup id) matches the id of
    # the corresponding subvolume.
    #
    # @return [Array<Integer>] includes two terms, level and id
    def id
      [storage_id.first, storage_id.second]
    end

    # @!method referenced
    #   Size of the referenced space of the qgroup
    #
    #   @return [DiskSize] zero if the size is not known (the qgroup was created after probing)
    storage_forward :referenced, as: "DiskSize"

    # @!method exclusive
    #   Size of the exclusive space of the qgroup
    #
    #   @return [DiskSize] zero if the size is not known (the qgroup was created after probing)
    storage_forward :exclusive, as: "DiskSize"

    storage_forward :storage_referenced_limit, to: :referenced_limit, as: "DiskSize"
    private :storage_referenced_limit

    # Limit of the referenced space for the qgroup
    #
    # @return [DiskSize] unlimited if there is no quota
    def referenced_limit
      return DiskSize.unlimited unless to_storage_value.has_referenced_limit

      storage_referenced_limit
    end

    # Setter for {#referenced_limit}
    #
    # @param limit [DiskSize] setting it to DiskSize.Unlimited removes the quota
    def referenced_limit=(limit)
      if limit.unlimited?
        to_storage_value.clear_referenced_limit
      else
        to_storage_value.referenced_limit = limit.to_i
      end
    end

    storage_forward :storage_exclusive_limit, to: :exclusive_limit, as: "DiskSize"
    private :storage_exclusive_limit

    # @!method exclusive_limit
    #   Limit of the exclusive space for the qgroup
    #
    #   @return [DiskSize] unlimited if there is no quota
    def exclusive_limit
      return DiskSize.unlimited unless to_storage_value.has_exclusive_limit

      storage_exclusive_limit
    end

    # Setter for {#exclusive_limit}
    #
    # @param limit [DiskSize] setting it to DiskSize.Unlimited removes the quota
    def exclusive_limit=(limit)
      if limit.unlimited?
        to_storage_value.clear_exclusive_limit
      else
        to_storage_value.exclusive_limit = limit.to_i
      end
    end

    protected

    # @see Device#is?
    def types_for_is
      super << :btrfs_qgroup
    end
  end
end
