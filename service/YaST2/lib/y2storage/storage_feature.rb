# Copyright (c) [2016-2023] SUSE LLC
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
require "storage"
require "y2storage/feature"

module Y2Storage
  #
  # Class representing the storage features defined by libstorage-ng
  #
  # In libstorage-ng each feature is represented by a bit-mask identified
  # by a constant with name UF_XXX (with XXX being the name of the feature).
  # A set of features is represented by a bit-field of those masks.
  #
  # Thus, one of those bit-fields is used to specify which features are
  # used in the current target machine's storage setup. Additionally, a similar
  # bit-field is used to report features that have been detected in the system
  # but that cannot be probed because some command is missing.
  #
  # This class adds object orientation of top of that, each instance of
  # StorageFeature represents a concrete feature and offers methods to know
  # which add-on packages would be needed so support that feature, so they
  # can be installed or marked for installation as needed.
  #
  class StorageFeature < Feature
    #======================================================================
    # Configurable part starts here
    #
    # Software packages required for storage features.
    # Any map value may be a string or a list of strings.
    #
    # Packages that are part of a minimal installation (e.g., "util-linux")
    # are not listed here.
    #
    # Those features correspond directly to the enum defined in
    # https://github.com/openSUSE/libstorage-ng/blob/master/storage/UsedFeatures.h
    #
    FEATURE_PACKAGES =
      {
        # SUSE standard technologies
        UF_LVM:              "lvm2",

        # RAID technologies and related
        UF_MULTIPATH:        ["device-mapper", "multipath-tools"],
        UF_DMRAID:           ["device-mapper", "dmraid"],
        UF_MDRAID:           "mdadm",

        # Btrfs needs e2fsprogs for 'lsattr' and 'chattr' to check for CoW
        UF_BTRFS:            ["btrfsprogs", "e2fsprogs"],

        # Other filesystems
        UF_EXT2:             "e2fsprogs",
        UF_EXT3:             "e2fsprogs",
        UF_EXT4:             "e2fsprogs",
        UF_XFS:              "xfsprogs",
        UF_REISERFS:         "reiserfs",
        UF_NILFS2:           "nilfs-utils",
        UF_NFS:              "nfs-client",
        UF_NTFS:             ["ntfs-3g", "ntfsprogs"],
        UF_VFAT:             "dosfstools",
        UF_EXFAT:            "exfatprogs",
        UF_F2FS:             "f2fs-tools",
        UF_UDF:              "udftools",
        UF_JFS:              "jfsutils",
        UF_SWAP:             [],

        # Crypto technologies
        UF_PLAIN_ENCRYPTION: "cryptsetup",
        UF_BITLOCKER:        [],
        # Device mapper is needed if names like /dev/mapper/cr_root are used at boot
        UF_LUKS:             ["device-mapper", "cryptsetup"],

        # Data transport methods
        UF_ISCSI:            "open-iscsi",
        UF_FCOE:             "fcoe-utils",
        UF_FC:               [],
        UF_DASD:             [],
        UF_PMEM:             [],
        UF_NVME:             "nvme-cli",

        # Other
        UF_QUOTA:            "quota",
        UF_BCACHE:           "bcache-tools",
        UF_BCACHEFS:         [], # When implemented: "bcachefs-tools"
        UF_SNAPSHOTS:        "snapper"
      }

    # Storage-related packages that are nice to have, but not absolutely
    # required.
    #
    # SLES-12 for example (unlike SLED-12) does not come with NTFS packages,
    # so they cannot be installed. But there might already be an existing
    # NTFS Windows partition on the disk; don't throw an error pop-up in that
    # case, just log a warning (bsc#1039830).
    #
    OPTIONAL_PACKAGES = ["ntfs-3g", "ntfsprogs", "exfat-utils", "f2fs-tools", "jfsutils", "nilfs-utils"]
    # configurable part ends here
    #======================================================================

    # All known libstorage-ng features
    #
    # @return [Array<StorageFeature>]
    def self.all
      @all ||= FEATURE_PACKAGES.map do |id, pkg_names|
        packages = Array(pkg_names).map do |pkg|
          Package.new(pkg, optional: OPTIONAL_PACKAGES.include?(pkg))
        end
        new(id, packages)
      end
    end

    # Drop the cache of packages for all known storage features
    #
    # This is only ever needed if the available packages might have changed
    # since the last use of this class.
    def self.drop_cache
      all.each(&:drop_cache)
    end

    # Constructor
    #
    # This looks up a constant in the ::Storage namespace to make sure the id
    # is known to libstorage-ng.
    #
    # @raise [NameError] if no constant for this feature is defined in libstorage-ng
    #
    # @param id [Symbol] see {#id}
    # @param packages [Array<Package>] see {#all_packages}
    def initialize(id, packages)
      super

      # Raising a NameError exception as soon as possible (i.e. in the constructor)
      # is a good way to make sure we are in sync with libstorage-ng regarding
      # the definition of possible features
      @bitmask = ::Storage.const_get(id)
    end

    # Whether the feature is included in the given bit-field
    #
    # @param bitfield [Integer]
    # @return [Boolean]
    def in_bitfield?(bitfield)
      (bitfield & bitmask) == bitmask
    end

    private

    # Bitmask for a storage feature
    #
    # This looks up a constant in the ::Storage (libstorage-ng) namespace with
    # the id of the feature (one of the enum values in UsedFeatures.h).
    #
    # @return [Integer]
    attr_reader :bitmask
  end
end
