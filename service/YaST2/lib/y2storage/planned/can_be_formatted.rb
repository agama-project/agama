# Copyright (c) [2015-2020] SUSE LLC
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

module Y2Storage
  module Planned
    # Mixin for planned devices that can have an associated block filesystem.
    # @see Planned::Device
    module CanBeFormatted # rubocop:disable Metrics/ModuleLength
      # @return [Filesystems::Type] the type of filesystem this device should
      #   get, like Filesystems::Type::BTRFS or Filesystems::Type::SWAP. A value of
      #   nil means the device will not be formatted.
      attr_accessor :filesystem_type

      # @return [String] label to enforce in the filesystem
      attr_accessor :label

      # @return [String] UUID to enforce in the filesystem
      attr_accessor :uuid

      # @overload subvolumes
      #   Btrfs subvolume specifications.
      #
      #   @return [Array<SubvolSpecification>]
      # @overload subvolumes=(list)
      #   Setter for #subvolumes which always create a local copy of the passed array
      #
      #   When assigning the list of subvolumes, this method automatically creates
      #   a copy of the original list to avoid the situation in which modifying
      #   the subvolumes of a planned device ends up modifying the original source
      #   of such list (bsc#1084213 and bsc#1084261).
      #
      #   Take into account this is not a deep copy. Only the collection is
      #   duplicated, the contained objects are still shared.
      #
      #   @example
      #     planned.subvolumes = my_list
      #     my_list << a_new_one
      #     # planned.subvolumes doesn't contain a_new_one now. This is not the
      #     # most common ruby behavior.
      #     my_list.first.path = "changed" # This change affects planned.subvolumes
      #     # because the object is also in that collection (not a deep copy).
      #
      #   @param list [Array<SubvolSpecification>]
      attr_reader :subvolumes

      # @return [String] Parent for all Btrfs subvolumes (typically "@")
      attr_accessor :default_subvolume

      # @return [Boolean] Whether a reused device should be formatted. If set to
      #   false, the existing filesystem should be kept. Only relevant if
      #   #reuse? is true.
      attr_accessor :reformat

      # @return [String] Options to be passed to the mkfs tool
      attr_accessor :mkfs_options

      # @return [Boolean] Whether quotas are enabled
      attr_accessor :quota
      alias_method :quota?, :quota

      # Initializations of the mixin, to be called from the class constructor.
      def initialize_can_be_formatted
        @subvolumes = []
        @reformat = false
        @snapshots = false
        @quota = false
      end

      # See #subvolumes
      def subvolumes=(list)
        @subvolumes = list.dup
      end

      # Creates a filesystem for the planned device on the specified real
      # BlkDevice object.
      #
      # This also sets all the filesystem attributes, like the mount point, and
      # creates the corresponding Btrfs subvolumes if needed.
      #
      # Do nothing if #filesystem_type is not set.
      #
      # FIXME: temporary API. It should be improved.
      #
      # @param blk_dev [BlkDevice]
      #
      # @return [Filesystems::BlkFilesystem] filesystem
      def format!(blk_dev)
        final_device = final_device!(blk_dev)
        return nil unless filesystem_type

        final_device.remove_descendants
        filesystem = final_device.create_blk_filesystem(filesystem_type)
        setup_filesystem(filesystem)
        setup_quota(filesystem)
        btrfs_setup(filesystem)

        filesystem
      end

      # Checks whether the filesystem type is Btrfs
      #
      # @return [Boolean]
      def btrfs?
        return false unless filesystem_type

        filesystem_type.is?(:btrfs)
      end

      # Checks whether the planned device has any subvolumes
      #
      # @return [Boolean]
      def subvolumes?
        btrfs? && !subvolumes.nil? && !subvolumes.empty?
      end

      # Subvolume specifications that would be shadowed by any of the given planned devices.
      #
      # @param all_devices [Array<Planned::Device>] all the devices planned for the system.
      # @return [Array<SubvolSpecification>]
      def shadowed_subvolumes(all_devices)
        return [] if subvolumes.nil?

        other_devices = all_devices - [self]
        other_mount_points = other_devices.flat_map { |dev| mount_points_for(dev) }
        subvolumes.select { |s| s.shadowed?(mount_point, other_mount_points) }
      end

      # @see #reformat
      #
      # @return [Boolean]
      def reformat?
        reformat
      end

      # Whether activation and configurion of Btrfs snapshots is wanted, if
      # possible, in the resulting filesystem.
      #
      # @see #snapshots?
      attr_writer :snapshots

      # Whether Btrfs snapshots should be activated in the resulting filesystem.
      #
      # @return [Boolean] true if snapshots are requested (see {#snapshots=}) and
      #   possible (so far, only for Btrfs root filesystems).
      def snapshots?
        @snapshots && btrfs? && root?
      end

      protected

      # Set basic filesystem attributes
      #
      # @param filesystem [Filesystems::BlkFilesystem]
      def setup_filesystem(filesystem)
        filesystem.label = label if label
        if uuid.nil? || uuid.empty?
          filesystem.init_uuid
        else
          filesystem.uuid = uuid
        end
        filesystem.mkfs_options = mkfs_options if mkfs_options
        # Note that a good reason for this to be the last step is that the
        # previous properties can affect the suitable mount_by, so they must be
        # set in advance
        setup_mount_point(filesystem)
      end

      def setup_mount_point(filesystem)
        assign_mount_point(filesystem)
        return if filesystem.mount_point.nil?

        setup_fstab_options(filesystem.mount_point)
      end

      # Set the fstab options, either those that were explicitly set, or the
      # defaults for this filesystem type
      #
      # @param mount_point [MountPoint]
      def setup_fstab_options(mount_point)
        return unless mount_point

        options = fstab_options_for(mount_point)
        mount_point.mount_options = options unless options.empty?
      end

      def setup_quota(filesystem)
        return unless filesystem.respond_to?(:quota=)

        filesystem.quota = quota?
      end

      # Returns fstab options for the given mount point
      #
      # @param mount_point [MountPoint]
      def fstab_options_for(mount_point)
        options =
          if fstab_options
            fstab_options
          elsif filesystem_type
            mount_point.default_mount_options
          else
            []
          end
        options.push("ro") if read_only && !options.include?("rw")
        options.uniq
      end

      # Creates subvolumes in the previously created filesystem that is placed
      # in the final device.
      #
      # This also sets other Btrfs attributes, like the default subvolume or
      # Filesystems::Btrfs#configure_snapper
      #
      # @param filesystem [Filesystems::BlkFilesystem]
      def btrfs_setup(filesystem)
        filesystem.configure_snapper = snapshots? if filesystem.respond_to?(:configure_snapper=)

        return unless filesystem.supports_btrfs_subvolumes?

        # If a default subvolume is configured (in control.xml), create it; if not,
        # use the toplevel subvolume that is implicitly created by mkfs.btrfs.
        filesystem.ensure_default_btrfs_subvolume(path: @default_subvolume)

        # Sets the subvolume prefix to create the rest of subvolumes as children of this one.
        filesystem.subvolumes_prefix = @default_subvolume || ""

        filesystem.add_btrfs_subvolumes(subvolumes) if subvolumes
      end

      def reuse_device!(device)
        super

        if reformat
          format!(device)
        else
          filesystem = final_device!(device).filesystem
          if filesystem
            setup_quota(filesystem)
            setup_mount_point(filesystem)
          end
        end
      end

      # @param filesystem [Filesystems::Base]
      def assign_mount_point(filesystem)
        return unless mount_point
        return if mount_point.empty?

        filesystem.mount_path = mount_point
        filesystem.mount_point.mount_by = mount_by if mount_by
      end

      # @param device [Planned::Device]
      def mount_points_for(device)
        points =
          if device.is_a?(LvmVg)
            device.lvs.map { |lv| mount_point_for(lv) }
          else
            [mount_point_for(device)]
          end

        points.compact
      end

      # @param device [Planned::Device]
      def mount_point_for(device)
        return nil unless device.respond_to?(:mount_point)
        return nil if device.mount_point.nil? || device.mount_point.empty?

        device.mount_point
      end
    end
  end
end
