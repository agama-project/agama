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

require "tempfile"

require "y2storage/storage_class_wrapper"
require "y2storage/mountable"
require "y2storage/filesystems/type"
require "y2storage/filesystem_reader"
require "y2storage/fstab"
require "y2storage/crypttab"

module Y2Storage
  module Filesystems
    # Abstract class to represent a filesystem, either a local (BlkFilesystem) or
    # a network one, like NFS.
    #
    # This is a wrapper for Storage::Filesystem
    class Base < Mountable
      wrap_class Storage::Filesystem,
        downcast_to: ["Filesystems::BlkFilesystem", "Filesystems::Nfs", "Filesystems::Tmpfs"]

      # @!method self.all(devicegraph)
      #   @param devicegraph [Devicegraph]
      #   @return [Array<Filesystems::Base>] all the filesystems in the given devicegraph
      storage_class_forward :all, as: "Filesystems::Base"

      # @!method type
      #   @return [Filesystems::Type]
      storage_forward :type, as: "Filesystems::Type"

      # @!method detect_space_info
      #   Information about the free space on a device.
      #
      #   The filesystem has to exists on the disk (i.e., in the probed
      #   devicegraph), this will mount it and then call the "df" command.
      #   Since both operations are expensive, caching this value is advised if
      #   it is needed repeatedly.
      #
      #   @raise [Storage::Exception] if the filesystem couldn't be mounted
      #     (e.g. it does not exist in the system or mount command failed)
      #
      #   @return [SpaceInfo]
      storage_forward :detect_space_info, as: "SpaceInfo"

      # Smart detection of free space
      #
      # It tries to use detect_space_info and caches it. But if it fails, it tries
      # to compute it from resize_info. If it fails again or filesystem is
      # not a block filesystem, then it returns zero size.
      #
      # @return [DiskSize]
      def free_space
        return @free_space if @free_space

        begin
          @free_space = detect_space_info.free
        rescue Storage::Exception
          # ok, we do not know it, so we try to detect ourself
          @free_space = compute_free_space
        end
      end

      # @return [Boolean]
      def in_network?
        false
      end

      # Checks whether the filesystem has the capability of hosting Btrfs subvolumes
      #
      # @return [Boolean] it only should be true for Btrfs.
      def supports_btrfs_subvolumes?
        false
      end

      # Whether the filesystem supports having a label
      #
      # @return [Boolean]
      def supports_label?
        false
      end

      # @see Mountable#extra_default_mount_options
      #
      # @return [Array<String>]
      def extra_default_mount_options
        if mount_point
          (super + type.default_fstab_options(mount_path)).uniq
        else
          super
        end
      end

      # Whether the kernel name used to reference the filesystem (that is, the
      # one used when mounting via {Filesystems::MountByType::Device) is stable
      # and remains equal across system reboots
      #
      # @return [Boolean]
      def stable_name?
        true
      end

      # Whether the filesystem sits directly on top of an encrypted device
      #
      # @return [Boolean]
      def encrypted?
        false
      end

      # Whether the content of the filesystem is lost after each system reboot
      #
      # @return [Boolean] true for swap devices encrypted with volatile keys
      def volatile?
        false
      end

      # Whether the current filesystem matches with a given fstab spec
      #
      # Most formats supported in the first column of /etc/fstab are recognized.
      # E.g. the string can be a kernel name, an udev name, an NFS specification
      # or a string starting with "UUID=" or "LABEL=".
      #
      # This method doesn't match by PARTUUID or PARTLABEL.
      #
      # Take into account that libstorage-ng discards during probing all the
      # udev names not considered reliable or stable enough. This method only
      # checks by the udev names recognized by libstorage-ng (not discarded).
      #
      # @param spec [String] content of the first column of an /etc/fstab entry
      # @return [Boolean]
      def match_fstab_spec?(spec)
        log.warn "Method of the base abstract class used to check #{spec}"
        false
      end

      # Whether the filesystem is suitable for a root filesystem
      #
      # @see Filesystems::Type#root_ok?
      #
      # @return [Boolean]
      def root_suitable?
        type.root_ok?
      end

      # Whether the filesystem is suitable for a Windows system
      #
      # @see Filesystems::Type#windows_ok?
      # @see BlkDevice#windows_suitable?
      #
      # @return [Boolean]
      def windows_suitable?
        type.windows_ok? && blk_devices.first.windows_suitable?
      end

      # Whether the filesystem contains a Windows system
      #
      # Note that the filesystem might be mounted when requested for first time.
      #
      # @return [Boolean]
      def windows_system?
        return false unless windows_suitable?

        # For BitLocker assume it is Windows without looking further
        # at the file system (it cannot be mounted anyway).
        return true if type.to_sym == :bitlocker

        !!fs_attribute(:windows)
      end

      # Whether the filesystem contains a Linux system
      #
      # Note that the filesystem might be mounted when requested for first time.
      #
      # @return [Boolean]
      def linux_system?
        !release_name.nil?
      end

      # Name of the system allocated by the filesystem
      #
      # For a Windows system it simply returns "Windows" as system name. For Linux it tries to read the
      # release name.
      #
      # Note that the filesystem might be mounted when requested for first time.
      #
      # @return [String, nil] nil if the system cannot be detected
      def system_name
        windows_system? ? "Windows" : release_name
      end

      # Release name of Linux system allocated by the filesystem
      #
      # Note that the filesystem might be mounted when requested for first time.
      #
      # @return [String, nil] nil if the system cannot be detected
      def release_name
        fs_attribute(:release_name)
      end

      # Whether the filesystem contains the Raspberry Pi boot code in the root path
      #
      # Note that the filesystem might be mounted when requested for first time.
      #
      # @return [Boolean]
      def rpi_boot?
        !!fs_attribute(:rpi_boot)
      end

      # Whether the filesystem contains the directory layout of an ESP partition
      #
      # Note that the filesystem might be mounted when requested for first time.
      #
      # @return [Boolean]
      def efi?
        !!fs_attribute(:efi)
      end

      # Retrieves the fstab from the filesystem
      #
      # Note that the filesystem might be mounted when requested for first time.
      #
      # @return [Y2Storage::Fstab, nil] nil if the fstab file is not found
      def fstab
        @fstab ||= etc_file("fstab")
      end

      # Retrieves the crypttab from the filesystem
      #
      # Note that the filesystem might be mounted when requested for first time.
      #
      # @return [Y2Storage::Crypttab, nil] nil if the crypttab file is not found
      def crypttab
        @crypttab ||= etc_file("crypttab")
      end

      protected

      # @see Device#is?
      def types_for_is
        super << :filesystem
      end

      # Value to return as fallback when the free space cannot be computed
      FREE_SPACE_FALLBACK = DiskSize.zero

      def compute_free_space
        # e.g. nfs where blk_devices cannot be queried
        return FREE_SPACE_FALLBACK unless respond_to?(:blk_devices)

        size = blk_devices.map(&:size).reduce(:+)
        used = resize_info.min_size
        size - used
      rescue Storage::Exception
        # it is questionable if this is correct behavior when resize_info failed,
        # but there is high chance we can't use it with libstorage, so better act like zero device.
        FREE_SPACE_FALLBACK
      end

      # Filesystem attribute obtained after mounting the filesystem
      #
      # Note that the filesystem is only mounted the first time that an attribute is requested.
      #
      # @param attr [Symbol] :windows, :release_name, :rpi_boot, :efi, :fstab, :crypttab
      # @return [Object] attribute value
      def fs_attribute(attr)
        read_fs_attributes unless userdata_value(:fs_attributes_already_read)

        userdata_value(attr)
      end

      # Reads and saves attributes from a probed filesystem
      #
      # It requires to mount the filesystem.
      #
      # @see Y2Storage::FilesystemReader
      def read_fs_attributes
        save_userdata(:fs_attributes_already_read, true)

        return unless exists_in_probed?

        reader = FilesystemReader.new(self)

        save_userdata(:windows, reader.windows?)
        save_userdata(:release_name, reader.release_name)
        save_userdata(:rpi_boot, reader.rpi_boot?)
        save_userdata(:efi, reader.efi?)
        save_userdata(:fstab, reader.fstab)
        save_userdata(:crypttab, reader.crypttab)
      end

      # Generates an etc file object
      #
      # Note that a temporary file is created with the content of the etc file because libstorage-ng API
      # requires a file path, see {Y2Storage::Fstab} and {Y2Storage::Crypttab}.
      #
      # @param file_name [String] "fstab" or "crypttab"
      # @return [Y2Storage::Fstab, Y2Storage::Crypttab, nil] nil if the file is not found
      def etc_file(file_name)
        file_content = fs_attribute(file_name.to_sym)

        return nil if file_content.nil?

        file_object = nil

        Tempfile.open("yast-storage-ng") do |file|
          file.write(file_content)
          file.rewind

          case file_name
          when "fstab"
            file_object = Fstab.new(file.path, self)
          when "crypttab"
            file_object = Crypttab.new(file.path, self)
          end
        end

        file_object
      end
    end
  end
end
