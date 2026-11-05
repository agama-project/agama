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
require "y2storage/device"
require "y2storage/mount_point"

module Y2Storage
  # Abstract class to represent something that can be mounted, like a filesystem
  # or a Btrfs subvolume
  #
  # This is a wrapper for Storage::Mountable
  class Mountable < Device
    wrap_class Storage::Mountable, downcast_to: ["Filesystems::Base", "BtrfsSubvolume"]

    # @!method self.all(devicegraph)
    #   @param devicegraph [Devicegraph]
    #   @return [Array<Mountable>] all mountable devices in the devicegraph
    storage_class_forward :all, as: "Mountable"

    # @!method supports_mount?
    #   @return [Boolean]
    storage_forward :supports_mount?

    storage_forward :storage_create_mount_point, to: :create_mount_point, as: "MountPoint"
    private :storage_create_mount_point

    storage_forward :storage_remove_mount_point, to: :remove_mount_point
    private :storage_remove_mount_point

    # @!method mount_point
    #   @return [MountPoint]
    storage_forward :mount_point, as: "MountPoint", check_with: :has_mount_point

    # Directory in which the device should be mounted
    #
    # @see MountPoint#path
    #
    # @return [String, nil] nil if it has no mount point
    def mount_path
      return nil if mount_point.nil?

      mount_point.path
    end

    # Sets the mount point path
    #
    # @note A new mount point is created if it does not exist, see {#create_mount_point}
    #
    # @param path [String]
    def mount_path=(path)
      mp = mount_point || create_mount_point("")
      mp.path = path
    end

    # Mount by method
    #
    # @see MountPoint#mount_by
    #
    # @return [Filesystems::MountByType, nil] nil if it has no mount point
    def mount_by
      return nil if mount_point.nil?

      mount_point.mount_by
    end

    # Mount options
    #
    # @see MountPoint#mount_options
    #
    # @return [Array<String>] empty if it has no mount point
    def mount_options
      return [] if mount_point.nil?

      mount_point.mount_options
    end

    # Mount options that may be needed for the system to boot correctly, but that are not currently
    # part of #{mount_options}
    #
    # @see MountPoint#adjust_mount_options
    #
    # @return [Array<String>]
    def missing_mount_options
      []
    end

    # Mount options that are currently part of #{mount_options} but that may prevent a correct
    # system boot
    #
    # @see MountPoint#adjust_mount_options
    #
    # @return [Array<String>]
    def unwanted_mount_options
      []
    end

    # Is the mount persistent?
    #
    # @return [Boolean] true if the mount point is saved to /etc/fstab
    #   (and will be mounted at boot again), false otherwise
    def persistent?
      return false if mount_point.nil?

      mount_point.in_etc_fstab?
    end

    # Checks whether the device is mounted as root
    #
    # @return [Boolean]
    def root?
      return false if mount_point.nil?

      mount_point.root?
    end

    # Whether the device contains a mount point that returns true for the given block or whether the
    # device is based in the same disk than another device containing such a mount point
    #
    # @return [Boolean]
    def disk_with_mount_point?(&block)
      return true if mount_point && block.call(mount_point)

      ([self] + ancestors).any? do |dev|
        dev.is_a?(BlkDevice) && dev.contain_mount_point?(&block)
      end
    end

    # Creates a mount point object for the device
    #
    # @param path [String]
    # @return [MountPoint]
    def create_mount_point(path)
      mp = storage_create_mount_point(path)
      # Trigger the calculations associated to the path (passno, etc.)
      mp.path = path
      # Recalculate etc status for the parent devices
      update_etc_status
      # Recalculate the crypt_options and mount_by for parent encryption devices
      adjust_crypt_devices
      # Ensure the mount_by makes sense
      mp.ensure_suitable_mount_by
      mp
    end

    # Removes the mount point object associated to the device
    #
    # @raise [Storage::Exception] if the mountable has no mount point
    def remove_mount_point
      storage_remove_mount_point
      adjust_crypt_devices
      update_etc_status
    end

    # Whether the device is mounted, according to the devicegraph
    #
    # @return [Boolean]
    def active_mount_point?
      !mount_point.nil? && mount_point.active?
    end

    # Updates the crypttab options for all the associated encryption devices
    #
    # @see Encryption#adjust_crypt_options
    def adjust_crypt_options
      ancestors.select { |d| d.is?(:encryption) }.each(&:adjust_crypt_options)
    end

    # Updates the crypttab options and the mount_by value for all the associated
    # encryption devices
    #
    # @see Encryption#adjust_crypt_options
    # @see Encryption#adjust_mount_by
    def adjust_crypt_devices
      ancestors.select { |d| d.is?(:encryption) }.each do |enc|
        enc.adjust_mount_by
        enc.adjust_crypt_options
      end
    end

    # Mount options proposed by YaST for mount points associated to this device,
    # in addition to the ones returned by libstorage-ng
    #
    # @see MountPoint#default_mount_options
    #
    # @note This method contains the 'extra' prefix in the name for two reasons.
    #   To make clear these options are added to the one provided by the library
    #   and to avoid possible conflicts in the future if the corresponding
    #   library methods become public (so far, they are internal but also called
    #   #default_mount_options).
    #
    # @return [Array<String>]
    def extra_default_mount_options
      []
    end

    private

    # Ensures a mount point before executing the given block
    #
    # A temporary mount point is created and removed when there is no mount point.
    #
    # @return [Object] block result
    def with_mount_point(&block)
      tmp_mount_point = false

      if !mount_point
        storage_create_mount_point("__fake_path__")
        tmp_mount_point = true
      end

      result = block.call(mount_point)

      storage_remove_mount_point if tmp_mount_point

      result
    end
  end
end
