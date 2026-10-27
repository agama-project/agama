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
require "y2storage/filesystems/blk_filesystem"
require "y2storage/btrfs_subvolume"
require "y2storage/btrfs_raid_level"
require "y2storage/subvol_specification"
require "y2storage/shadower"

Yast.import "ProductFeatures"

module Y2Storage
  module Filesystems
    # This is a wrapper for Storage::Btrfs
    class Btrfs < BlkFilesystem
      wrap_class Storage::Btrfs

      # @!method top_level_btrfs_subvolume
      #   Top level Btrfs subvolume
      #
      #   Btrfs filesystems always have a top level subvolume, the mkfs.btrfs
      #   command implicitly creates it, so does libstorage when creating the
      #   data structures.
      #
      #   The top level Btrfs subvolume always has ID 5.
      #
      #   @return [BtrfsSubvolume]
      storage_forward :top_level_btrfs_subvolume, as: "BtrfsSubvolume"

      # @!method default_btrfs_subvolume
      #   The default Btrfs subvolume (typically @).
      #
      #   @note When a new Btrfs filesystem is created, a top level subvolume is added and
      #   initialized as default subvolume.
      #
      #   @see #default_btrfs_subvolume
      #
      #   @return [BtrfsSubvolume]
      storage_forward :default_btrfs_subvolume, as: "BtrfsSubvolume"

      # @!method btrfs_subvolumes
      #   Collection of Btrfs subvolumes of the filesystem
      #   @return [Array<BtrfsSubvolume>]
      storage_forward :btrfs_subvolumes, as: "BtrfsSubvolume"

      # @!method find_btrfs_subvolume_by_path(path)
      #   Finds a subvolume by its path
      #
      #   @param path [String] subvolume path
      #   @return [BtrfsSubvolume, nil] nil if it does not find a subvolume with this path
      storage_forward :find_btrfs_subvolume_by_path, as: "BtrfsSubvolume"

      # @!attribute configure_snapper
      #   Whether libstorage-ng should perform the initial steps to configure
      #   Snapper on this filesystem
      #
      #   @return [Boolean]
      storage_forward :configure_snapper
      storage_forward :configure_snapper=

      # @!attribute metadata_raid_level
      #
      #   Setting the metadata RAID level is not supported for Btrfs already existing on disk.
      #
      #   @return [BtrfsRaidLevel]
      storage_forward :metadata_raid_level, as: "BtrfsRaidLevel"
      storage_forward :metadata_raid_level=

      # @!attribute data_raid_level
      #
      #   Setting the data RAID level is not supported for Btrfs already existing on disk.
      #
      #   @return [BtrfsRaidLevel]
      storage_forward :data_raid_level, as: "BtrfsRaidLevel"
      storage_forward :data_raid_level=

      # @!method allowed_metadata_raid_levels
      #
      #   Gets the allowed metadata RAID levels for the Btrfs. So far, this depends on the number of
      #   devices. Levels for which mkfs.btrfs warns that they are not recommended are not included here.
      #   Additionally DEFAULT is allowed when creating a btrfs.
      #
      #   @return [Array<BtrfsRaidLevel>]
      storage_forward :allowed_metadata_raid_levels, as: "BtrfsRaidLevel"

      # @!method allowed_data_raid_levels
      #
      #   Gets the allowed data RAID levels for the Btrfs. So far, this depends on the number of
      #   devices. Levels for which mkfs.btrfs warns that they are not recommended are not included here.
      #   Additionally DEFAULT is allowed when creating a btrfs.
      #
      #   @return [Array<BtrfsRaidLevel>]
      storage_forward :allowed_data_raid_levels, as: "BtrfsRaidLevel"

      # @!method add_device(device)
      #
      #   Adds a block device to the Btrfs
      #
      #   @param device [BlkDevice]
      #   @raise [Storage::WrongNumberOfChildren] if the device cannot be added
      storage_forward :add_device

      # @!method remove_device(device)
      #
      #   Removes a block device from the Btrfs. Not supported for Btrfs already existing on disk.
      #
      #   @param device [BlkDevice]
      #   @raise [Storage::Exception] if the device cannot be removed
      storage_forward :remove_device

      # @!method btrfs_qgroups
      #   Collection of Btrfs qgroups of the filesystem
      #   @return [Array<BtrfsQgroup>]
      storage_forward :btrfs_qgroups, as: "BtrfsQgroup"

      # @!method has_quota
      #   Whether quota support is enabled for this btrfs filesystem
      #
      #   @return [Boolean]
      storage_forward :has_quota
      alias_method :quota?, :has_quota

      # @!method quota=(value)
      #   Enable or disable quota for the btrfs
      #
      #   When disabling quota, all qgroups and qgroup relations of the btrfs are removed.
      #
      #   When enabling quota, qgroups and qgroup relations are created for the
      #   btrfs. This is done so that no qgroup related actions will be done during
      #   commit (unless further changes are done). If quota was disabled during probing,
      #   the qgroups are created like btrfs would do. If quota was enabled during
      #   probing, the qgroups from probing are restored.
      #
      #   @raise [Storage::Exception] according to libstorage-ng documentation this method
      #     can raise an exception, although the circumstances are not clear.
      #
      #   @param value [Boolean]
      storage_forward :quota=

      # Only Btrfs should support subvolumes
      def supports_btrfs_subvolumes?
        true
      end

      # Whether the filesystem contains subvolumes (without taking into account the top level one)
      #
      # @return [Boolean]
      def btrfs_subvolumes?
        btrfs_subvolumes.reject(&:top_level?).any?
      end

      # Convert path to canonical form.
      #
      # That is, a single slash between elements. No leading or final slashes.
      #
      # @param path [String] subvolume path
      #
      # @return [String] sanitized subvolume path
      #
      def canonical_subvolume_name(path)
        path.squeeze("/").chomp("/").sub(/^\//, "")
      end

      # Check if a subvolume can be created.
      #
      # It can always be created if we're going to create the whole file
      # system anyway.
      #
      # If the file system exists already there must at least be nothing
      # else below path.
      #
      # @param path [String] subvolume path
      #
      # @return [Boolean]
      #
      def subvolume_can_be_created?(path)
        return true unless exists_in_raw_probed?

        !subvolume_descendants_exist?(path)
      end

      # List of subvolumes hierarchically below path
      #
      # That is, subvolumes starting with path.
      #
      # @param path [String] subvolume path
      #
      # @return [Array<BtrfsSubvolume>]
      def subvolume_descendants(path)
        path = canonical_subvolume_name(path)
        path += "/" unless path.empty?
        btrfs_subvolumes.find_all { |sv| sv.path.start_with?(path) && sv.path != path }
      end

      # Returns the default subvolume, creating it when necessary
      #
      # If a specific default subvolume path is requested, returns a subvolume with
      # that path. If requested path is nil, returns the current default subvolume,
      # presumably the toplevel one implicitly created by mkfs.btrfs.
      #
      # This default subvolume is the parent for all others on Btrfs 'filesystem'.
      #
      # @note When requested path is the empty string and a default subvolume already
      #   exists (for example @), top level subvolume will be set as default.
      #
      # @param path [String, nil] path for the default subvolume
      #
      # @return [BtrfsSubvolume]
      def ensure_default_btrfs_subvolume(path: nil)
        return default_btrfs_subvolume if path.nil?

        # If a given default subvolume (typically "@") is specified in control.xml, this must be
        # created first (or promoted to default if it already exists), and it will be the parent of
        # all the other subvolumes. Otherwise, the toplevel subvolume would be their direct parent.
        # Notice that this "@" subvolume does not show up in "btrfs subvolume list".
        subvolume = find_btrfs_subvolume_by_path(path)
        subvolume ||= top_level_btrfs_subvolume.create_btrfs_subvolume(path)
        subvolume.set_default_btrfs_subvolume unless subvolume.default_btrfs_subvolume?

        subvolume
      end

      # Deletes a btrfs subvolume that belongs to the filesystem
      #
      # @note The filesystem must have a default subvolume. When the default subvolume is deleted,
      #   the top level subvolume is set as the new default subvolume. Moreover, the top level
      #   subvolume cannot be deleted.
      #
      # @param path [String] path of subvolume to delete
      def delete_btrfs_subvolume(path)
        subvolume = find_btrfs_subvolume_by_path(path)
        return if subvolume.nil? || subvolume.top_level?

        deleted_default = subvolume.default_btrfs_subvolume?

        devicegraph.remove_btrfs_subvolume(subvolume)
        top_level_btrfs_subvolume.set_default_btrfs_subvolume if deleted_default

        # Resets the prefix to force to re-calculate it next time a subvolume is added
        self.subvolumes_prefix = nil unless btrfs_subvolumes?
      end

      # Creates a new btrfs subvolume for the filesystem
      #
      # If the subvolume already exists, returns it.
      #
      # @note The subvolume mount point is generated from the filesystem mount point
      # and the subvolume path.
      #
      # @see #btrfs_subvolume_mount_point
      #
      # @param path [string] absolute subvolume path
      # @param nocow [Boolean] no copy on write property
      #
      # @return [BtrfsSubvolume, nil] new subvolume
      #
      def create_btrfs_subvolume(path, nocow)
        path = canonical_subvolume_name(path)

        subvolume = find_btrfs_subvolume_by_path(path)
        return subvolume if subvolume

        if !subvolume_can_be_created?(path)
          log.error "cannot create subvolume #{path}"
          return
        end

        if subvolume_descendants_exist?(path)
          create_btrfs_subvolume_full_rebuild(path, nocow)
        else
          create_btrfs_subvolume_nochecks(path, nocow)
        end
      end

      # Adds btrfs subvolumes defined from a list of specs
      #
      # @note A subvolume is added only when it does not exist in the filesystem
      #   and it makes sense for the current architecture.
      #
      # @see SubvolSpecification#create_btrfs_subvolume
      #
      # @param specs [Array<SubvolSpecification>]
      def add_btrfs_subvolumes(specs)
        arch_specs = Y2Storage::SubvolSpecification.for_current_arch(specs)

        arch_specs.each do |spec|
          path = btrfs_subvolume_path(spec.path)
          next unless find_btrfs_subvolume_by_path(path).nil?

          spec.create_btrfs_subvolume(self)
        end
      end

      # Returns a subvolume path for the filesystem
      #
      # The subvolume path is generated from the subvolumes prefix and the relative version
      # of the subvolume path (without the subvolumes prefix).
      #
      # @example
      #   filesystem.subvolumes_prefix # => "@"
      #
      #   filesystem.btrfs_subvolume_path("foo") # => "@/foo"
      #   filesystem.btrfs_subvolume_path("@/foo") # => "@/foo"
      #
      # @param subvolume_path [String] a subvolume path (absolute or relative)
      #
      # @return [String] subvolume path for the filesystem
      def btrfs_subvolume_path(subvolume_path)
        Btrfs.btrfs_subvolume_path(subvolumes_prefix, path_without_prefix(subvolume_path))
      end

      # Returns a subvolume mount point for the filesystem
      #
      # The subvolume mount point is generated from the filesystem mount point and
      # the subvolume path. When the filesystem is not mounted, the subvolume mount
      # point will be nil.
      #
      # @example
      #   filesystem.mount_path # => "/foo"
      #
      #   filesystem.btrfs_subvolume_mount_point("bar") # => "/foo/bar"
      #   filesystem.btrfs_subvolume_mount_point("@/bar") # => "/foo/bar"
      #
      # @param subvolume_path [String] a subvolume path (absolute or relative)
      #
      # @return [String, nil] nil whether the filesystem is not mounted
      def btrfs_subvolume_mount_point(subvolume_path)
        Btrfs.btrfs_subvolume_mount_point(mount_path, path_without_prefix(subvolume_path))
      end

      # Returns a subvolume path generated from a default subvolume path and
      # the a subvolume path
      #
      # The path is forced to be relative.
      #
      # @example
      #   Btrfs.btrfs_subvolume_path("@", "foo") # => "@/foo"
      #
      # @param subvolumes_prefix [String] prefix for the subvolumes
      # @param subvolume_path [String] a subvolume path
      #
      # @return [String, nil] nil whether any path is not valid
      def self.btrfs_subvolume_path(subvolumes_prefix, subvolume_path)
        return nil if subvolumes_prefix.nil? || subvolume_path.nil?

        path = Pathname(File.join(subvolumes_prefix, subvolume_path))
        return path.to_s unless path.absolute?

        path.relative_path_from(MountPoint::ROOT_PATH).to_s
      end

      # Returns a subvolume mount point generated from a filesystem mount point and a
      # subvolume path
      #
      # @example
      #   Btrfs.btrfs_subvolume_mount_point("/foo", "bar") # => "/foo/bar"
      #
      # @param fs_mount_path [String] a filesystem mount path
      # @param subvolume_path [String] a subvolume path
      #
      # @return [String, nil] nil whether the filesystem mount path or the subvolume
      #   path is not valid
      def self.btrfs_subvolume_mount_point(fs_mount_path, subvolume_path)
        return nil if fs_mount_path.nil?
        return nil if subvolume_path.nil?

        File.join(fs_mount_path, subvolume_path)
      end

      # Subvolumes that have been automatically deleted without user
      # intervention to avoid shadowing.
      #
      # @note This relies on the userdata mechanism (see {#userdata_value}), so
      # modifications to the returned object will not be automatically persisted
      # to the device. Always use {#auto_deleted_subvolumes=} to modify the list.
      #
      # @return [Array<SubvolSpecification>]
      def auto_deleted_subvolumes
        userdata_value(:auto_deleted_subvolumes) || []
      end

      # Stores the information for {#auto_deleted_subvolumes}
      #
      # @param subvolumes [Array<SubvolSpecification>]
      def auto_deleted_subvolumes=(subvolumes)
        save_userdata(:auto_deleted_subvolumes, subvolumes || [])
      end

      # Updates the list of subvolumes for the Btrfs filesystems
      #
      # Subvolumes are shadowed or unshadowed according to current mount points
      # in the whole system.
      #
      # @see Y2Storage::Shadower#refresh_shadowing
      #
      # @param devicegraph [Devicegraph]
      def self.refresh_subvolumes_shadowing(devicegraph)
        Y2Storage::Shadower.new(devicegraph).refresh_shadowing
      end

      # Btrfs subvolumes prefix, typically @ for root.
      #
      # The subvolume prefix in inferred in case it is not set yet, see {#infer_subvolumes_prefix}. Note
      # that all new subvolumes will be created as children of the subvolume prefix, and their paths will
      # be prepended with the subvolumes prefix.
      #
      # @return [String]
      def subvolumes_prefix
        self.subvolumes_prefix = infer_subvolumes_prefix unless userdata_value(:subvolumes_prefix)

        userdata_value(:subvolumes_prefix)
      end

      # Sets the subvolumes prefix
      #
      # Note that setting it to nil forces to {#subvolumes_prefix} to infer the prefix.
      #
      # @param value [String, nil]
      def subvolumes_prefix=(value)
        save_userdata(:subvolumes_prefix, value)
      end

      # Determines whether the snapshots (snapper) are activated
      #
      # @return [Boolean] true if snapshots are present
      def snapshots?
        snapshots_subvolume = btrfs_subvolumes.any? { |s| s.path == snapshots_root }
        snapshots_subvolume || configure_snapper
      end

      # @return [String] Snapshots root subvolume name
      SNAPSHOTS_ROOT_SUBVOL_NAME = ".snapshots".freeze

      # Determines the snapshots root subvolume
      #
      # @return [String] Snapshots root subvolume
      def snapshots_root
        @snapshots_root ||= Pathname.new(subvolumes_prefix).join(SNAPSHOTS_ROOT_SUBVOL_NAME).to_s
      end

      # Copy the mount_by mode from this btrfs to all subvolumes (that have a
      # mount point).
      #
      # @return [Filesystems::MountByType, nil]
      #
      def copy_mount_by_to_subvolumes
        return nil if mount_point.nil?

        mount_by = mount_point.mount_by
        manual = mount_point.manual_mount_by?
        log.info "copying mount_by #{mount_by} to all subvolumes"
        btrfs_subvolumes.each do |subvol|
          next if subvol.mount_point.nil?

          subvol.mount_point.assign_mount_by(mount_by)
          subvol.mount_point.manual_mount_by = manual
        end
        mount_by
      end

      # Default value for #configure_snapper, according to system configuration
      #
      # @return [Boolean]
      def default_configure_snapper?
        return false unless volume_specification

        # FIXME: this is not ready for multi-device Btrfs (blk_devices.first)
        volume_specification.snapper_for_device?(blk_devices.first)
      end

      # Creates the default subvolumes setup for a newly created filesystem,
      # according to the volumes specification.
      #
      # The default subvolume is created first and then the proposed subvolumes are added.
      #
      # A proposed subvolume is added only when it does not exist in the filesystem and it
      # makes sense for the current architecture.
      #
      # @see #ensure_default_btrfs_subvolume
      # @see #add_btrfs_subvolumes
      def setup_default_btrfs_subvolumes
        spec = volume_specification
        return unless spec

        ensure_default_btrfs_subvolume(path: spec.btrfs_default_subvolume)

        # Sets the subvolume prefix to create the rest of subvolumes as children of this one.
        self.subvolumes_prefix = spec.btrfs_default_subvolume

        add_btrfs_subvolumes(spec.subvolumes) if spec.subvolumes
      end

      protected

      def path_without_prefix(subvolume_path)
        subvolume_path.gsub(subvolumes_prefix, "")
      end

      # @see Device#is?
      def types_for_is
        super << :btrfs
      end

      private

      DEFAULT_CANDIDATE_SUBVOLUMES_PREFIX = "@".freeze
      private_constant :DEFAULT_CANDIDATE_SUBVOLUMES_PREFIX

      # Tries to infer the subvolumes prefix
      #
      # There is a subvolumes prefix when the top level subvolume has only a child and that child
      # subvolume is suitable as prefix, see {#suitable_subvolume_prefix?}. Otherwise, an empty string
      # is considered as prefix.
      #
      # @return [String]
      def infer_subvolumes_prefix
        subvolumes = top_level_btrfs_subvolume.children
        return "" if subvolumes.size != 1

        subvolume = subvolumes.first
        return "" unless suitable_subvolume_prefix?(subvolume)

        subvolume.path
      end

      # Whether the given subvolume fulfills all the conditions to be a prefix
      #
      # To consider a subvolume as prefix suitable, the path of all its children must start with its
      # path. Moreover, its path must be one of the candidate prefixes.
      #
      # @see #candidate_subvolume_prefixes
      #
      # @param subvolume [Y2Storage::BtrfsSubvolume]
      # @return [Boolean]
      def suitable_subvolume_prefix?(subvolume)
        return false unless subvolume.children.all? { |s| s.path.start_with?(subvolume.path) }

        return false unless candidate_subvolume_prefixes.include?(subvolume.path)

        true
      end

      # Possible subvolume prefixes to consider
      #
      # @return [Array<String>]
      def candidate_subvolume_prefixes
        [DEFAULT_CANDIDATE_SUBVOLUMES_PREFIX, volume_specification&.btrfs_default_subvolume].compact.uniq
      end

      # Check for existing descendants of a subvolume path.
      #
      # @param path [String] subvolume path
      #
      # @return [Boolean]
      #
      def subvolume_descendants_exist?(path)
        subvolume_descendants(path).any?
      end

      # Find the most suitable parent for a new subvolume
      #
      # That is, the one with the longest path that is part of path.
      #
      # @param path [String] subvolume path
      #
      # @return [BtrfsSubvolume] parent subvolume
      #
      def suitable_parent_subvolume(path)
        while path.include?("/")
          path = path.gsub(/\/[^\/]*$/, "")
          subvolume = find_btrfs_subvolume_by_path(path)
          return subvolume if subvolume
        end

        top_level_btrfs_subvolume
      end

      # Create a new btrfs subvolume for the filesystem
      #
      # This method must be used if the new subvolume does not fit into the
      # existing subvolume hierarchy.
      #
      # It will remove all subvolumes but the top level one and then rebuild
      # them from scratch including the new subvolume.
      #
      # @see #create_btrfs_subvolume
      #
      # @param path [string] absolute subvolume path
      # @param nocow [Boolean] no copy on write property
      #
      # @return [BtrfsSubvolume] new subvolume
      #
      def create_btrfs_subvolume_full_rebuild(path, nocow)
        log.info "subvolume hierarchy mismatch - recreate all"

        subvolumes = btrfs_subvolumes.map { |x| x.top_level? ? nil : [x.path, x.nocow?] }.compact
        subvolumes.push([path, nocow])

        default_subvolume = default_btrfs_subvolume.path
        top_level_btrfs_subvolume.set_default_btrfs_subvolume

        log.info "recreating subvolumes #{subvolumes}, default #{default_subvolume}"

        top_level_btrfs_subvolume.remove_descendants

        # sort: shortest path first
        subvolumes.sort! { |x, y| x[0] <=> y[0] }
        subvolumes.each { |x| create_btrfs_subvolume_nochecks(*x) }

        subvolume = find_btrfs_subvolume_by_path(default_subvolume)
        subvolume&.set_default_btrfs_subvolume

        find_btrfs_subvolume_by_path(path)
      end

      # Create a new btrfs subvolume for the filesystem
      #
      # @see #create_btrfs_subvolume
      #
      # This method does not verify if the subvolume can be added to the
      # existing subvolume hierarchy. Use {create_btrfs_subvolume} instead.
      #
      # @param path [string] absolute subvolume path
      # @param nocow [Boolean] no copy on write property
      #
      # @return [BtrfsSubvolume] new subvolume
      #
      def create_btrfs_subvolume_nochecks(path, nocow)
        parent_subvolume = suitable_parent_subvolume(path)

        log.info "creating subvolume #{path} at #{parent_subvolume.path}"

        subvolume = parent_subvolume.create_btrfs_subvolume(path)
        subvolume.nocow = nocow
        subvolume.set_default_mount_point

        subvolume
      end
    end
  end
end
