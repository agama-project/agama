# Copyright (c) [2018-2020] SUSE LLC
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
require "y2storage/encryption"
require "y2storage/encryption_type"
require "y2storage/filesystems/mount_by_type"
require "pathname"

module Y2Storage
  # Class to represent a mount point
  #
  # This is a wrapper for Storage::MountPoint
  class MountPoint < Device
    wrap_class Storage::MountPoint

    # @return [Pathname] Object that represents the root path
    ROOT_PATH = Pathname.new("/").freeze

    # @return [Pathname] Object that represents the ESP path
    ESP_PATH = Pathname.new("/boot/efi").freeze

    # @return [Pathname] Object that represents the swap path
    SWAP_PATH = Pathname.new("swap").freeze

    # @return [Symbol] Filesystem types which should use some value
    #   (other than 0) in the fs_passno field
    TYPES_WITH_PASSNO = [:ext2, :ext3, :ext4, :jfs].freeze
    private_constant :TYPES_WITH_PASSNO

    # @!method self.all(devicegraph)
    #   @param devicegraph [Devicegraph]
    #
    #   @return [Array<MountPoint>] all mount points in the devicegraph
    storage_class_forward :all, as: "MountPoint"

    # @!method self.find_by_path(devicegraph, path)
    #   @param devicegraph [Devicegraph]
    #   @param path [String] path of the mount point. See {#path}
    #
    #   @return [Array<MountPoint>]
    storage_class_forward :find_by_path, as: "MountPoint"

    # @!method path
    #   @return [String]
    storage_forward :path

    storage_forward :storage_path=, to: :path=
    private :storage_path=

    storage_forward :storage_default_mount_options, to: :default_mount_options
    private :storage_default_mount_options

    # Sets the value for {#path} and ensures {#passno} has a value consistent
    # with the new path
    #
    # @param path [String]
    # @raise [Storage::InvalidMountPointPath] if trying to set an invalid path
    def path=(path)
      self.storage_path = path

      to_storage_value.passno =
        if passno_must_be_set?
          root? ? 1 : 2
        else
          0
        end

      Y2Storage::Encryption.update_dm_names(devicegraph)
    end

    # @!method mount_by
    #   The way the "mount" command identifies the mountable
    #
    #   This defines the form of the first field in the fstab file.
    #
    #   The concrete meaning depends on the value. Note that some types
    #   address the filesystem while others address the underlying device.
    #
    #   * DEVICE: For NFS, the server and path. For regular filesystems, the
    #     kernel device name or a link in /dev (but not in /dev/disk) of the
    #     block device that contains the filesystem.
    #   * UUID: The UUID of the filesystem.
    #   * LABEL: the label of the filesystem.
    #   * ID: one of the links in /dev/disk/by-id to the block device
    #     containing the filesystem.
    #   * PATH: one of the links in /dev/disk/by-path to the block device
    #     containing the filesystem.
    #
    #   Not to be confused with {Encryption#mount_by}, which refers to the form
    #   of the crypttab file.
    #
    #   @return [Filesystems::MountByType]
    storage_forward :mount_by, as: "Filesystems::MountByType"

    # @!method assign_mount_by
    #   Low level setter to enforce a value for {#mount_by} without performing
    #   any consistency fix, like updating {#manual_mount_by?} or syncing the
    #   Btrfs subvolumes
    #
    #   @see #mount_by=
    storage_forward :assign_mount_by, to: :mount_by=

    # Setter for {#mount_by} which ensures a consistent value for
    # {#manual_mount_by?} and for the corresponding attribute of the Btrfs
    # subvolumes (if applicable)
    #
    # @param value [Filesystems::MountByType]
    def mount_by=(value)
      self.manual_mount_by = true
      assign_mount_by(value)
      return unless mountable.respond_to?(:copy_mount_by_to_subvolumes)

      mountable.copy_mount_by_to_subvolumes
    end

    # @!method mount_options
    #   Options to use in /etc/fstab for a newly created mount point.
    #
    #   @note This returns an array based on the underlying SWIG vector,
    #   modifying the returned object will have no effect in the MountPoint
    #   object. Use #mount_options= to actually change the value. See examples.
    #
    #   @example This will not modify the options
    #     mount_point.mount_options << "ro"
    #     mount_point.mount_options # "ro" was not added
    #
    #   @example This will work as expected
    #     mount_point.mount_options = mount_point.mount_options + ["ro"]
    #     mount_point.mount_options # "ro" was added
    #
    #   @return [Array<String>]
    storage_forward :mount_options

    # Sets mount options
    #
    # @note Avoid overriding the subvolume option for btrfs subvolumes unless
    #   you are certain what you are doing.
    #
    # @param options [Array<String>]
    def mount_options=(options)
      to_storage_value.mount_options.clear
      options&.each { |o| to_storage_value.mount_options << o }
      mountable.adjust_crypt_options
      mount_options
    end

    # Adjusts the mount options as needed to avoid problems during booting
    #
    # See jsc#SLE-20535, bsc#1176140, bsc#1165937 and jsc#SLE-7687
    def adjust_mount_options
      self.mount_options = mount_options + missing_mount_options - unwanted_mount_options
    end

    # @see Mountable#missing_mount_options
    def missing_mount_options
      mountable.missing_mount_options
    end

    # @see Mountable#unwanted_mount_options
    def unwanted_mount_options
      mountable.unwanted_mount_options
    end

    # @!method set_default_mount_by
    #   Set the mount-by method to the global default, see Storage::get_default_mount_by()
    storage_forward :set_default_mount_by, to: :default_mount_by=

    # @!method storage_possible_mount_bys
    #   Returns the possible mount-by methods for the mount point.
    #   LABEL is included even if the filesystem label is not set.
    #
    #   @return [Array<Filesystems::MountByType>]
    storage_forward :storage_possible_mount_bys, as: "Filesystems::MountByType",
      to: :possible_mount_bys
    private :storage_possible_mount_bys

    # redefine possible_mount_bys to filter out unsupported values
    # @see #storage_possible_mount_bys
    def possible_mount_bys
      storage_possible_mount_bys & Filesystems::MountByType.all
    end

    # @!attribute mount_type
    #   Filesystem type used to mount the device, as specified in fstab and/or
    #   in the mount command.
    #
    #   @return [Filesystems::Type]
    storage_forward :mount_type, as: "Filesystems::Type"
    storage_forward :mount_type=

    # @!method in_etc_fstab?
    #   Whether the mount point is present (probed devicegraph) or
    #   will be present (staging devicegraph) in /etc/fstab
    #
    #   @return [Boolean]
    storage_forward :in_etc_fstab?

    # @!method in_etc_fstab=(value)
    #   Whether the mount point will be present in /etc/fstab
    #
    #   @param value [Boolean]
    storage_forward :in_etc_fstab=

    # @!method active?
    #   Whether the mount point is mounted (probed devicegraph) or
    #   should be mounted (staging devicegraph)
    #
    #   @return [Boolean]
    storage_forward :active?

    # @!method active=(value)
    #
    #   Sets the {#active?} flag
    #
    #   @param value [Boolean]
    storage_forward :active=

    # @!method immediate_deactivate
    #   Immediately deactivates (unmount) the mount point object. In
    #   contrast to {#active=} this function acts immediately and does
    #   not require calling to commit.
    #
    #   @note The mount point object must exist in the probed devicegraph.
    #
    #   @raise [Storage::Exception] when it cannot be unmounted.
    storage_forward :immediate_deactivate

    # @!method mountable
    #   Gets the mountable of the mount point (filesystem, BTRFS subvolume, etc)
    #
    #   @return [Mountable]
    storage_forward :mountable, as: "Mountable", check_with: :has_mountable

    # @!method filesystem
    #   Gets the filesystem of the mount point
    #
    #   @return [Filesystems::Base]
    storage_forward :filesystem, as: "Filesystems::Base"

    # @!method passno
    #   Value for the fs_passno field for fstab(5). The passno field is used by
    #   the fsck(8) program to determine the order in which filesystem checks
    #   are done at reboot time.
    #
    #   @return [Integer]
    storage_forward :passno

    # @!method freq
    #   Value for the fs_freq field for fstab(5). The freq field is used by the
    #   dump(8) command to determine which filesystems need to be dumped. The
    #   field is likely obsolete.
    #
    #   @return [Integer]
    storage_forward :freq

    # Whether the mount point is root
    #
    # @return [Boolean]
    def root?
      path == ROOT_PATH.to_s
    end

    # Whether the mount point is the ESP
    #
    # @return [Boolean]
    def esp?
      path == ESP_PATH.to_s
    end

    # @see Device#in_etc?
    # @see #in_etc_fstab
    def in_etc?
      in_etc_fstab?
    end

    # Whether the given path is equivalent to {#path}
    #
    # This method is more robust than a simple string comparison, since it takes
    # into account trailing slashes and similar potential problems.
    #
    # @param other_path [String, Pathname]
    # @return [Boolean]
    def path?(other_path)
      Pathname.new(other_path).cleanpath == Pathname.new(path).cleanpath
    end

    # List of mount-by methods that make sense for the mount point
    #
    # Using a value that is not suitable would lead to libstorage-ng ignoring
    # that value during the commit phase. In such case, DEVICE is used by the
    # library as fallback.
    #
    # @param label [Boolean, nil] whether the associated filesystem has a label.
    #   If set to nil, that is checked in the devicegraph. If set to true, it
    #   will assume the filesystem has a label. If set to false, it will assume
    #   there is no label, no matter what the devicegraph says.
    # @param encryption [Boolean, nil] whether the filesystem sits on top of an
    #   encrypted device. Regarding the possible values (nil, true and false) it
    #   behaves like the label argument.
    # @param assume_uuid [Boolean] whether it can be safely assumed that the
    #   filesystem has a known UUID (as long as UUIDs are supported for that
    #   filesystem type). True by default because most filesystems will get an
    #   UUID assigned to them in the moment they are created in the real system,
    #   even if that UUID is still not known by the devicegraph. If set to false,
    #   mounting by UUID will only be considered suitable if the UUID is already
    #   known in the devicegraph.
    #
    # @return [Array<Filesystems::MountByType>]
    def suitable_mount_bys(label: nil, encryption: nil, assume_uuid: true)
      with_mount_point_for_suitable(encryption) do |mount_point|
        fs = mount_point.filesystem

        # For swaps encrypted with volatile keys, UUID and LABEL are not an option
        # because their are re-created on every boot.
        # PATH and ID are not an option either, because encryption devices don't
        # have udev links.
        return [Filesystems::MountByType::DEVICE] if fs.volatile?

        # #possible_mount_bys already filters out ID and PATH for devices without
        # a current udev id and/or path recognized by libstorage-ng
        candidates = mount_point.possible_mount_bys
        return candidates unless fs.is?(:blk_filesystem)

        label = (fs.label.size > 0) if label.nil?
        uuid = assume_uuid ? true : !fs.uuid.empty?

        filter_mount_bys(candidates, label, uuid)
        candidates
      end
    end

    # If the current mount_by is suitable, it does nothing.
    #
    # Otherwise, it assigns the best option from all the suitable ones
    #
    # @see #suitable_mount_bys
    def ensure_suitable_mount_by
      suitable = suitable_mount_bys
      return if suitable.include?(mount_by)

      assign_mount_by(Filesystems::MountByType.best_for(filesystem, suitable))
    end

    # Whether {#mount_by} was explicitly set by the user
    #
    # @note This relies on the userdata mechanism, see {#userdata_value}.
    #
    # @return [Boolean]
    def manual_mount_by?
      !!userdata_value(:manual_mount_by)
    end

    # Enforces de value for {#manual_mount_by?}
    #
    # @note This relies on the userdata mechanism, see {#userdata_value}.
    #
    # @param value [Boolean]
    def manual_mount_by=(value)
      save_userdata(:manual_mount_by, value)
    end

    # Mount options that YaST would propose as the default ones for this mount
    # point, having into account the mount path, the type of filesystem, the
    # underlying device and similar criteria
    #
    # @note This extends the corresponding Storage::MountPoint#default_mount_options
    #   provided by libstorage-ng. This adds YaST-specific options on top of the
    #   ones provided by the method in the library (which so far only returns the
    #   'subvol=' option when needed).
    #
    # @return [Array<String>]
    def default_mount_options
      storage_default_mount_options + mountable.extra_default_mount_options
    end

    # Set {#mount_options} to the default value
    #
    # This overrides the Storage::MountsPoint#set_default_mount_options method
    # provided by libstorage-ng. The original one only sets the default values
    # calculated by the library, while this relies on {#default_mount_options}.
    def set_default_mount_options
      self.mount_options = default_mount_options
    end

    # @see #mounted_by_init?
    INITRD_MOUNT_OPTION = "x-initrd.mount".freeze
    private_constant :INITRD_MOUNT_OPTION

    # Whether YaST expects this mount point to be already initialized in the initramfs
    #
    # @return [Boolean]
    def mounted_by_init?
      # Intentionally avoiding String#casecmp to check the mount option, turns out
      # X-what.ever has a different semantic than x-what.ever (see "man -s8 mount")
      root? || mount_options.include?(INITRD_MOUNT_OPTION)
    end

    protected

    # @see Device#is?
    def types_for_is
      super << :mount_point
    end

    # Whether a non-zero {#passno} makes sense for this mount point
    #
    # @return [Boolean]
    def passno_must_be_set?
      return false unless mountable&.is?(:filesystem)

      filesystem.type.is?(*TYPES_WITH_PASSNO) || esp?
    end

    # Executes the given block on a mount point that has been adapted to honor
    # the argument "encryption" of {#suitable_mount_bys}
    #
    # @param encryption [Boolean, nil] see {#suitable_mount_bys}
    def with_mount_point_for_suitable(encryption, &block)
      mount_point =
        if tmp_mount_point_needed?(encryption)
          # Instance the temporary devicegraph here to make sure the garbage
          # collector doesn't kill it before calling the given block
          tmp_graph = devicegraph.dup
          mount_point_for_suitable(tmp_graph)
        else
          self
        end

      block.call(mount_point)
    end

    # @see #with_mount_point_for_suitable
    #
    # @param encryption [Boolean, nil]
    # @return [Boolean]
    def tmp_mount_point_needed?(encryption)
      return false if encryption.nil? || encryption == filesystem.encrypted?
      return false unless filesystem.is?(:blk_filesystem)
      # Since it's hard to know what to do in this case...
      return false if filesystem.multidevice?

      true
    end

    # DeviceMapper name for the temporary encryption created to calculate the
    # suitable mount by types
    TMP_NAME = "dmtemp".freeze
    private_constant :TMP_NAME

    # Temporary mount point used for the calculation of {#suitable_mount_bys}
    #
    # @param graph [Devicegraph] temporary devicegraph to safely do any change
    # @return [MountPoint]
    def mount_point_for_suitable(graph)
      mount_point = graph.find_device(sid)
      blk_dev = mount_point.filesystem.blk_devices.first
      if blk_dev.is?(:encryption)
        blk_dev.blk_device.remove_encryption
      else
        # We don't know which encryption type will be used, but LUKS1 is the
        # default and, in most cases, the only option
        blk_dev.create_encryption(TMP_NAME, EncryptionType::LUKS1)
      end

      mount_point
    end

    # @see #suitable_mount_bys
    #
    # @param candidates [Array<Filesystems::MountByType>]
    # @param label [Boolean]
    # @param uuid [Boolean]
    def filter_mount_bys(candidates, label, uuid)
      candidates.delete(Filesystems::MountByType::LABEL) unless label
      candidates.delete(Filesystems::MountByType::UUID) unless uuid
    end
  end
end
