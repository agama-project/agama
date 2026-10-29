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

require "y2storage/subvol_specification"
require "y2storage/mountable"

module Y2Storage
  # Class to manage the shadowing of Btrfs subvolumes
  #
  # This class is used to automatically shadow Btrfs Subvolumes. In some cases, Btrfs subvolumes are
  # automatically added when creating a Btrfs. Those subvolumes should also be automatically hidden when
  # other device shadows them. Moreover, subvolumes that already exist on disk or manually added by the
  # user should be automatically mounted or unmounted depending on whether they are shadowed or not.
  class Shadower
    # Constructor
    #
    # @param devicegraph [Devicegraph]
    # @param filesystems [Array<Filesystems::Base>, nil] list of filesystems to take care. If
    #   nil, all the filesystems are taken into account.
    def initialize(devicegraph, filesystems: nil)
      @devicegraph = devicegraph
      @filesystems = filesystems || all_filesystems
    end

    # Updates the list of subvolumes for the Btrfs filesystems
    #
    # Subvolumes are shadowed or unshadowed according to current mount points in the whole system.
    #
    # @see #shadow_btrfs_subvolumes
    # @see #unshadow_btrfs_subvolumes
    def refresh_shadowing
      btrfs_filesystems.each do |filesystem|
        shadow_btrfs_subvolumes(filesystem)
        unshadow_btrfs_subvolumes(filesystem)
      end
    end

    # Checks whether a mount path is shadowing another mount path
    #
    # @note The existence of devices with that mount paths is not checked.
    #
    # @param mount_path [String]
    # @param other_mount_path [String]
    #
    # @return [Boolean] true if other_mount_path is shadowed by mount_path
    def self.shadowing?(mount_path, other_mount_path)
      return false if mount_path.nil? || other_mount_path.nil?
      return false if mount_path.empty? || other_mount_path.empty?

      # Just checking with start_with? is not sufficient:
      # "/bootinger/schlonz".start_with?("/boot") -> true
      # So append "/" to make sure only complete subpaths are compared:
      # "/bootinger/schlonz/".start_with?("/boot/") -> false
      # "/boot/schlonz/".start_with?("/boot/") -> true
      check_path = "#{other_mount_path}/"
      check_path.start_with?("#{mount_path}/")
    end

    private

    # @return [Devicegraph]
    attr_reader :devicegraph

    # Filesystems to take care when performing the shadowing
    #
    # @return [Array<Filesystems::Base>]
    attr_reader :filesystems

    # All filesystems in the system
    #
    # @return [Array<Filesystems::Base>]
    def all_filesystems
      devicegraph.blk_filesystems
    end

    # Btrfs filesystems from the list of filesystems to consider for the shadowing
    #
    # @return [Array<Filesystems::Btrfs>]
    def btrfs_filesystems
      filesystems.select { |f| f.is?(:btrfs) }
    end

    # Shadows all the currently shadowed subvolumes from the given filesystem
    #
    # @param filesystem [Filesystems::Btrfs]
    def shadow_btrfs_subvolumes(filesystem)
      shadowed_btrfs_subvolumes(filesystem).each { |s| shadow_btrfs_subvolume(s) }
    end

    # Shadows the given subvolume
    #
    # To shadow means to either delete or unmount the subvolume, depending on the subvolume can be auto
    # deleted or not.
    #
    # @param subvolume [BtrfsSubvolume]
    def shadow_btrfs_subvolume(subvolume)
      if subvolume.can_be_auto_deleted?
        delete_btrfs_subvolume(subvolume)
      else
        remove_mount_point(subvolume)
      end
    end

    # Removes the given subvolume
    #
    # The subvolume is cached into {auto_deleted_subvolumes} list.
    #
    # @param subvolume [BtrfsSubvolume]
    def delete_btrfs_subvolume(subvolume)
      filesystem = subvolume.filesystem

      add_auto_deleted(filesystem, subvolume)
      filesystem.delete_btrfs_subvolume(subvolume.path)
    end

    # Adds a subvolume to the list of auto deleted subvolumes, see {#auto_deleted_list}
    #
    # @param filesystem [Filesystems::Btrfs] filesystem where to cach the subvolume as auto deleted
    # @param subvolume [BtrfsSubvolume] subvolume to cach
    def add_auto_deleted(filesystem, subvolume)
      spec = SubvolSpecification.new(subvolume.path, copy_on_write: subvolume.nocow?)
      specs = filesystem.auto_deleted_subvolumes.push(spec)
      filesystem.auto_deleted_subvolumes = specs
    end

    # Removes the mount point of the given subvolume
    #
    # @param subvolume [BtrfsSubvolume]
    def remove_mount_point(subvolume)
      return unless subvolume.mount_point

      subvolume.remove_mount_point
    end

    # Unshadows all the currently unshadowed subvolumes from the given filesystem
    #
    # To unshadow means to restore the auto deleted subvolumes or to mount the subvolumes if needed.
    #
    # @param filesystem [Filesystems::Btrfs]
    def unshadow_btrfs_subvolumes(filesystem)
      unshadowed_btrfs_subvolumes_specs(filesystem).each do |spec|
        unshadow_btrfs_subvolume_spec(filesystem, spec)
      end

      unshadowed_btrfs_subvolumes(filesystem).each { |s| unshadow_btrfs_subvolume(s) }
    end

    # Restores a previously auto deleted subvolume
    #
    # If there already is a subvolume with the same path, the auto deleted subvolume is not restored.
    #
    # @see #remove_auto_deleted
    #
    # @param filesystem [Filesystems::Btrfs] filesystem where to remove the subvolume as auto deleted
    # @param spec [SubvolSpecification] specification of the subvolume to restore
    def unshadow_btrfs_subvolume_spec(filesystem, spec)
      subvolume_path = filesystem.btrfs_subvolume_path(spec.path)

      return if filesystem.find_btrfs_subvolume_by_path(subvolume_path)

      subvolume = spec.create_btrfs_subvolume(filesystem)
      remove_auto_deleted(filesystem, subvolume)
    end

    # Removes a subvolume from the list of auto deleted subvolumes, see {#auto_deleted_list}
    #
    # @param filesystem [Filesystems::Btrfs] filesystem where to remove the subvolume as auto deleted
    # @param subvolume [BtrfsSubvolume] subvolume to remove as auto deleted
    def remove_auto_deleted(filesystem, subvolume)
      specs = filesystem.auto_deleted_subvolumes.reject { |s| s.path == subvolume.path }
      filesystem.auto_deleted_subvolumes = specs
    end

    # Unshadows a subvolume
    #
    # To unshadow means to restore its default mount point.
    #
    # @param subvolume [BtrfsSubvolume] subvolume to unshadow
    def unshadow_btrfs_subvolume(subvolume)
      subvolume.set_default_mount_point
    end

    # Btrfs subvolumes from the given filesystem, excluding the top level one
    #
    # @param filesystem [Filesystems::Btrfs]
    # @return [Array<BtrfsSubvolume>]
    def btrfs_subvolumes(filesystem)
      filesystem.btrfs_subvolumes.reject(&:top_level?)
    end

    # Currently shadowed Btrfs subvolumes from the given filesystem
    #
    # @param filesystem [Filesystems::Btrfs]
    # @return [Array<BtrfsSubvolume>]
    def shadowed_btrfs_subvolumes(filesystem)
      btrfs_subvolumes(filesystem).select { |s| shadowed?(s) }
    end

    # Specification of the currently unshadowed Btrfs subvolumes from the list of auto deleted subvolumes
    # of the given filesystem
    #
    # @param filesystem [Filesystems::Btrfs]
    # @return [Array<SubvolSpecification>]
    def unshadowed_btrfs_subvolumes_specs(filesystem)
      filesystem.auto_deleted_subvolumes.reject do |spec|
        mount_path = filesystem.btrfs_subvolume_mount_point(spec.path)
        shadowed_path?(mount_path)
      end
    end

    # Currently unshadowed subvolumes from the given filesystem
    #
    # @param filesystem [Filesystems::Btrfs]
    # @return [Array<BtrfsSubvolume>]
    def unshadowed_btrfs_subvolumes(filesystem)
      subvolumes = btrfs_subvolumes(filesystem).select { |s| s.mount_point.nil? }

      subvolumes.reject do |subvolume|
        mount_path = filesystem.btrfs_subvolume_mount_point(subvolume.path)
        shadowed_path?(mount_path)
      end
    end

    # Whether the given subvolume is currently shadowed
    #
    # @param subvolume [BtrfsSubvolume]
    # @return [Boolean]
    def shadowed?(subvolume)
      shadowers = shadowers(subvolume.mount_path)
      shadowers.reject! { |s| s.sid == subvolume.sid || s.sid == subvolume.filesystem.sid }

      !shadowers.empty?
    end

    # Checks whether a mount path is currently shadowed by any other mount path
    #
    # @param mount_path [String]
    # @return [Boolean]
    def shadowed_path?(mount_path)
      !shadowers(mount_path).empty?
    end

    # Returns the current shadowers for a specific mount path
    #
    # @param mount_path [String]
    # @return [Array<Mountable>] shadowers
    def shadowers(mount_path)
      Mountable.all(devicegraph).select { |m| Shadower.shadowing?(m.mount_path, mount_path) }
    end
  end
end
