# Copyright (c) [2017-2020] SUSE LLC
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
require "y2storage/btrfs_qgroup"
require "y2storage/mountable"

module Y2Storage
  # A subvolume in a Btrfs filesystem
  #
  # This is a wrapper for Storage::BtrfsSubvolume
  class BtrfsSubvolume < Mountable
    wrap_class Storage::BtrfsSubvolume

    # @!method btrfs
    #   @return [Filesystems::BlkFilesystem]
    storage_forward :btrfs, as: "Filesystems::BlkFilesystem"
    alias_method :blk_filesystem, :btrfs
    alias_method :filesystem, :btrfs

    # @!method id
    #   @return [Integer]
    storage_forward :id

    # @!method top_level?
    #   @return [Boolean] whether this is the top-level subvolume
    storage_forward :top_level?

    # @!method top_level_btrfs_subvolume
    #   @return [BtrfsSubvolume] top-level subvolume
    storage_forward :top_level_btrfs_subvolume, as: "BtrfsSubvolume"

    # @!method path
    #   @return [String] path of the subvolume
    storage_forward :path

    # @!method nocow?
    #   @return [Boolean] whether No-Copy-On-Write is enabled
    storage_forward :nocow?

    # @!method nocow=(value)
    #   @see #nocow?
    #   @param value [Boolean]
    storage_forward :nocow=

    # @!method default_btrfs_subvolume?
    #   @return [Boolean] whether this is the default subvolume
    storage_forward :default_btrfs_subvolume?

    # @!method create_btrfs_subvolume(path)
    #   @param path [String] path of the new subvolume
    #   @return [BtrfsSubvolume]
    storage_forward :create_btrfs_subvolume, as: "BtrfsSubvolume"

    # @!method btrfs_qgroup
    #   Level 0 qgroup associated to this subvolume, if any
    #
    #   @return [BtrfsQgroup, nil]
    storage_forward :btrfs_qgroup, as: "BtrfsQgroup", check_with: :has_btrfs_qgroup

    # @!method create_btrfs_qgroup
    #   Creates the corresponding level 0 qgroup for the subvolume
    #
    #   Quota support must be enabled for the filesystem (see {Filesystems::Btrfs#quota?}).
    #   If that's the case, usually the qgroup already exists unless it was removed by
    #   the user.
    #
    #   @raise [Storage::Exception] if quota support is not enabled
    storage_forward :create_btrfs_qgroup, as: "BtrfsQgroup"

    # Sets this subvolume as the default one
    def set_default_btrfs_subvolume
      # The original libstorage method is wrongly renamed to
      # :default_btrfs_subvolume= by SWIG, because it's named like a setter
      # although it is not.
      to_storage_value.public_send(:default_btrfs_subvolume=)
    end

    # Assigns the default mount point for this subvolume
    #
    # Note that the current mount point is deleted if the subvolume does not require a default mount
    # point, see {#require_default_mount_point?}.
    def set_default_mount_point
      if !require_default_mount_point?
        remove_mount_point if mount_point
        return
      end

      default_mount_path = filesystem.btrfs_subvolume_mount_point(path)

      return if mount_path == default_mount_path

      remove_mount_point if mount_point

      create_mount_point(default_mount_path)
    end

    # Create a mount point with the same mount_by as the parent Btrfs.
    #
    # @param path [String]
    # @return [MountPoint]
    def create_mount_point(path)
      super
      copy_mount_by_from_filesystem
      mount_point
    end

    # Copy the parent filesystem's mount_by from the parent filesystem.
    #
    # @return [Filesystems::MountByType, nil]
    def copy_mount_by_from_filesystem
      return nil if mount_point.nil? || filesystem.mount_point.nil?

      mount_point.manual_mount_by = filesystem.mount_point.manual_mount_by?
      mount_point.assign_mount_by(filesystem.mount_point.mount_by)
    end

    # Whether the subvolume can be auto deleted, for example when a proposed
    # subvolume is shadowed
    #
    # @return [Boolean]
    def can_be_auto_deleted?
      value = userdata_value(:can_be_auto_deleted)
      value.nil? ? false : value
    end

    # @see #can_be_auto_deleted?
    def can_be_auto_deleted=(value)
      save_userdata(:can_be_auto_deleted, value)
    end

    # Size of the referenced space of the subvolume, if known
    #
    # The information is obtained from the qgroup of level 0 associated to the subvolume,
    # which implies it can only be known if quotas are enabled for the filesystem.
    # If quota support is disabled, this method returns nil.
    #
    # If the filesystem already existed during probing but got no quota support enabled at
    # that moment, this method returns zero if quota support was enabled after probing.
    #
    # @return [DiskSize, nil] nil if quota support is disabled, zero if it was enabled only
    #   after probing, the known size in any other case
    def referenced
      btrfs_qgroup&.referenced
    end

    # Size of the exclusive space of the subvolume, if known
    #
    # See {#referenced} for details about the possible returned values in several situations.
    #
    # @return [DiskSize, nil] nil if quota support is disabled, zero if it was enabled only
    #   after probing, the known size in any other case
    def exclusive
      btrfs_qgroup&.exclusive
    end

    # Limit of the referenced space for the subvolume
    #
    # @return [DiskSize] unlimited if there is no quota
    def referenced_limit
      btrfs_qgroup&.referenced_limit || DiskSize.unlimited
    end

    # Limit of the referenced space for the subvolume
    #
    # @return [DiskSize] unlimited if there is no quota
    def exclusive_limit
      btrfs_qgroup&.exclusive_limit || DiskSize.unlimited
    end

    # Setter for #{referenced_limit}
    #
    # Works only if quotas are enabled for the filesystem (see {Filesystems::Btrfs#quota?})
    #
    # @param limit [DiskSize] setting it to DiskSize.Unlimited removes the quota
    def referenced_limit=(limit)
      return unless create_missing_qgroup

      if referenced_limit && !referenced_limit.unlimited?
        save_userdata(:former_referenced_limit, referenced_limit)
      end
      btrfs_qgroup.referenced_limit = limit
    end

    # Setter for #{exclusive_limit}
    #
    # Works only if quotas are enabled for the filesystem (see {Filesystems::Btrfs#quota?})
    #
    # @param limit [DiskSize] setting it to DiskSize.Unlimited removes the quota
    def exclusive_limit=(limit)
      return unless create_missing_qgroup

      btrfs_qgroup.exclusive_limit = limit
    end

    # Previous significant (ie. not unlimited) value of {#referenced_limit}
    #
    # Used by the Partitioner to restore the value of the corresponding widget if the
    # user re-enables the limit, which improves the sense of continuity.
    #
    # @return [DiskSize, nil] nil if the limit has never changed
    def former_referenced_limit
      userdata_value(:former_referenced_limit)
    end

    # Whether the subvolume is used as prefix (typically @)
    #
    # @return [Boolean]
    def prefix?
      path == filesystem.subvolumes_prefix
    end

    # Whether the subvolume is a snapshot
    #
    # @return [Boolean]
    def snapshot?
      path.start_with?(filesystem.snapshots_root + "/")
    end

    protected

    # Whether the subvolume requires a default mount point
    #
    # Only subvolumes for root require a default mount point. This is necessary to correctly mount the
    # subvolumes when snapshoting is used. Also note that a subvolume does not require a mount point when
    # any of its ancestors already has a mount point or when the subvolume is a snapshot.
    #
    # Example:
    #
    # top-level                       -> false
    # |-- @                           -> false
    #    |-- var                      -> true
    #    |  |-- log                   -> false
    #    |-- .snapshots               -> false
    #        |--.snapshots/1/snapshot -> false
    # |-- foo                         -> true
    #
    # @return [Boolean]
    def require_default_mount_point?
      return false unless filesystem.root?
      return false if top_level? || default_btrfs_subvolume? || for_snapshots?

      parent_subvolume.top_level? || parent_subvolume.prefix?
    end

    # Whether the subvolume is used for snapshots
    #
    # @return [Boolean]
    def for_snapshots?
      path == filesystem.snapshots_root || snapshot?
    end

    # Parent subvolume
    #
    # @return [BtrfsSubvolume, nil]
    def parent_subvolume
      parents.find { |p| p.is?(:btrfs_subvolume) }
    end

    # Returns the associated level 0 qgroup, creating one if needed and possible
    #
    # @return [BtrfsQgroup, nil] nil if quotas are disabled for the filesystem, a valid
    #   qgroup (new or pre-existing) in any other case
    def create_missing_qgroup
      btrfs_qgroup || create_btrfs_qgroup
      # libstorage-ng throws an exception for #create_btrfs_qgroup if quotas are disabled
    rescue Storage::Exception
      nil
    end

    # @see Device#is?
    def types_for_is
      super << :btrfs_subvolume
    end
  end
end
