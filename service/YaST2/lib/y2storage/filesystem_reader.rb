# Copyright (c) [2019-2022] SUSE LLC
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
require "fileutils"
require "yast2/execute"

Yast.import "OSRelease"

module Y2Storage
  # Class to read the content of a filesystem
  #
  # The filesystem is mounted only the first time that any info is requested
  class FilesystemReader
    include Yast::Logger

    # Constructor
    #
    # @param filesystem [Filesystems::Base, Filesystems::LegacyNfs]
    # @param mount_point [String]
    def initialize(filesystem, mount_point = "/mnt")
      @filesystem = filesystem
      @mount_point = mount_point
    end

    # Whether the filesystem contains a Windows system
    #
    # @return [Boolean]
    def windows?
      !!fs_attribute(:windows)
    end

    # Linux release name from the filesystem
    #
    # @return [String, nil] nil if the release name is not found
    def release_name
      fs_attribute(:release_name)
    end

    # Whether the filesystem contains the Raspberry Pi boot code in the root path
    #
    # @return [Boolean]
    def rpi_boot?
      !!fs_attribute(:rpi_boot)
    end

    # Whether the filesystem contains the directories layout of an ESP partition
    #
    # @return [Boolean]
    def efi?
      !!fs_attribute(:efi)
    end

    # Fstab raw content from the filesystem
    #
    # @return [String, nil] nil if the fstab file cannot be read
    def fstab
      fs_attribute(:fstab)
    end

    # Crypttab raw content from the filesystem
    #
    # @return [Crypttab, nil] nil if the crypttab file cannot be read
    def crypttab
      fs_attribute(:crypttab)
    end

    # Whether the device is accessible
    #
    # This is only checked for NFS filesystems, filesystems on top of a block device are always
    # reachable by definition (otherwise, the block device wouldn't be in the devicegraph).
    #
    # @return [Boolean]
    def reachable?
      return true unless filesystem.is?(:nfs) || filesystem.is?(:legacy_nfs)

      mountable?
    end

    private

    # @return [Filesystems::Base]
    attr_reader :filesystem

    # @return [String]
    attr_reader :mount_point

    # Attributes that are read from the filesystem
    FS_ATTRIBUTES = {
      windows:      nil,
      release_name: nil,
      rpi_boot:     nil,
      efi:          nil,
      fstab:        nil,
      crypttab:     nil
    }.freeze

    private_constant :FS_ATTRIBUTES

    # Filesystem attributes
    #
    # @return [Hash<Symbol, Object>]
    def fs_attributes
      @fs_attributes ||= FS_ATTRIBUTES.dup
    end

    # A filesystem attribute
    #
    # Note that the filesystem is mounted the first time that an attribute is requested.
    #
    # @param attr [Symbol] :windows, :release_name, :rpi_boot, :fstab, :crypttab
    # @return [Object]
    def fs_attribute(attr)
      read unless @already_read

      fs_attributes[attr]
    end

    # Save the value of a filesyste attribute
    #
    # @param attr [Symbol]
    # @param value [Object]
    def save_fs_attribute(attr, value)
      fs_attributes[attr] = value
    end

    # Checks whether the file exists in the temporarily mounted filesystem
    #
    # @param path_parts [String] each component of the path (relative to the root
    #   of the mounted filesystem), as used by File.join
    # @param directory [Boolean] return true only if the file exists and is a
    #   directory
    # @return [Boolean]
    def file_exist?(*path_parts, directory: false)
      full_path = File.join(mount_point, *path_parts)
      directory ? File.directory?(full_path) : File.exist?(full_path)
    end

    # Reads the filesystem attributes
    #
    # Note that the filesystem is mounted the first time that the attributes are read.
    def read
      @already_read = true

      windows_system? ? read_windows_system : read_linux_system
    end

    # Reads attributes for a Windows system
    def read_windows_system
      save_fs_attribute(:windows, true)
    end

    # Reads attributes for a Linux system
    def read_linux_system
      save_fs_attribute(:windows, false)

      mount
      save_fs_attribute(:release_name, read_release_name)
      save_fs_attribute(:rpi_boot, check_rpi_boot)
      save_fs_attribute(:efi, check_efi)
      save_fs_attribute(:fstab, read_fstab)
      save_fs_attribute(:crypttab, read_crypttab)
      umount
    rescue RuntimeError => e # FIXME: rescue ::Storage::Exception when SWIG bindings are fixed
      log.error("CAUGHT exception: #{e}")
      nil
    end

    # Whether the filesystem contains a Windows system
    #
    # Note that the filesystem needs to be mounted, see {Filesystems::BlkFilesystem#detect_content_info}.
    #
    # @return [Boolean]
    def windows_system?
      return false if filesystem.is?(:legacy_nfs)
      return false unless filesystem.windows_suitable?

      filesystem.detect_content_info.windows?
    rescue Storage::Exception
      log.warn("content info cannot be detected for filesystem #{filesystem.uuid}")
      false
    end

    # Reads the Linux release name
    #
    # @return [String, nil] nil if the filesystem does not contain a release name
    def read_release_name
      # This check is needed because {Yast::OSRelease.ReleaseName} returns a default release name when
      # the file is not found.
      return nil unless file_exist?(Yast::OSRelease.class::OS_RELEASE_PATH)

      release_name = Yast::OSRelease.ReleaseName(mount_point)

      release_name.empty? ? nil : release_name
    end

    # Reads the fstab file
    #
    # @return [String, nil] nil if the filesystem does not contain a fstab file
    def read_fstab
      read_etc_file("fstab")
    end

    # Reads the crypttab file
    #
    # @return [String, nil] nil if the filesystem does not contain a crypttab file
    def read_crypttab
      read_etc_file("crypttab")
    end

    # Reads an etc file (fstab or crypttab)
    #
    # @param file_name [String] "etc", "crypttab"
    # @return [String, nil] nil if the filesystem does not contain that etc file
    def read_etc_file(file_name)
      return nil unless file_exist?("etc", file_name)

      path = File.join(mount_point, "etc", file_name)
      File.readlines(path).join
    end

    # Checks whether the Raspberry Pi boot code is in the root of the filesystem
    #
    # @return [Boolean]
    def check_rpi_boot
      # Only lower-case is expected, but since casing is usually tricky in FAT
      # filesystem, let's do a second check just in case
      ["bootcode.bin", "BOOTCODE.BIN"].each do |name|
        return true if file_exist?(name)
      end

      false
    end

    # Checks whether the typical ESP directories are at the root of the filesystem
    #
    # @return [Boolean]
    def check_efi
      # Upper-case vs lower-case is usually tricky in FAT filesystems
      ["EFI", "efi"].each do |name|
        return true if file_exist?(name, directory: true)
      end

      false
    end

    # Mounts the filesystem
    #
    # @see #execute
    #
    # @note libstorage-ng has a couple of ways for immediate mounting/unmounting devices, but
    #   they cannot be easily used here.
    #
    #   For example, BlkFilesystem::detect_content_info uses an internal EnsureMounted object.
    #   EnsureMounted mounts a given filesystem during its construction and unmounts it during
    #   its destruction. In ruby there is no a clear way of calling the destructor of a binding
    #   object, so EnsureMounted cannot be used for a temporary mount to inspect the filesystem
    #   content from YaST and then unmount it.
    #
    #   Besides that, MountPoint offers MountPoint::immediate_activate and ::immediate_deactivate,
    #   but these methods only can be used with probed mount points. Internally, these methods
    #   use Mountable::Impl::immediate_activate and ::immediate_deactivate. Such methdos could
    #   be offered in the public API, but they require to create a temporary mount point for the
    #   filesystem to mount. Creating a mount point could have some implications, see
    #   {Device#update_etc_status}, and moreover, a possible existing mount point should be
    #   correctly restored.
    #
    #   The library API needs to be extended to easily mount/umount a device in an arbitrary
    #   path without modifying the device (i.e., without changing its current mount point).
    #
    # @raise [RuntimeError] when the filesystem cannot be mounted
    def mount
      cmd = ["/usr/bin/mount", "-o", "ro", mount_name, mount_point]

      raise "mount failed for #{mount_name}" unless execute(*cmd)
    end

    # Unmounts the filesystem
    #
    # @see #mount
    # @see #execute
    #
    # @raise [RuntimeError] when the filesystem cannot be unmounted
    def umount
      cmd = ["/usr/bin/umount", "-R", mount_point]

      raise "umount failed for #{mount_point}" unless execute(*cmd)
    end

    # Silently unmounts the filesystem if it is mounted, this method raises no error if something
    # goes wrong
    #
    # @see #mountable?
    def umount_if_possible
      umount
    rescue RuntimeError
      nil
    end

    # Checks whether it's possible to perform a test mount of the filesystem
    #
    # @return [Boolean] true if it was possible to mount the filesystem
    def mountable?
      mount
      true
    rescue RuntimeError
      false
    ensure
      umount_if_possible
    end

    # Device name to use when mounting a filesystem
    #
    # Note that the filesystem must exist on disk, so it should have an UUID.
    #
    # @return [String]
    def mount_name
      return filesystem.name if filesystem.is?(:nfs)
      return filesystem.share if filesystem.is?(:legacy_nfs)

      "UUID=#{filesystem.uuid}"
    end

    # Executes a given command
    #
    # For possible parameters, see Yast::Execute.locally!.
    #
    # @return [Boolean] true if the command finishes correctly; false otherwise.
    def execute(*args)
      Yast::Execute.locally!(*args)
      true
    rescue Cheetah::ExecutionFailed
      false
    end
  end
end
