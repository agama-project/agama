# Copyright (c) 2020 SUSE LLC
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
require "y2storage/sysconfig_storage"

module Y2Storage
  #
  # Class to obtain the used filesystems of a devicegraph.
  #
  class UsedFilesystems
    include Yast::Logger

    # Constructor
    #
    # @param devicegraph Devicegraph
    def initialize(devicegraph)
      @devicegraph = devicegraph
    end

    # Write the used filesystems to /etc/sysconfig/storage.
    def write
      value = filesystems.join(" ")
      log.info("writing USED_FS_LIST #{value}")
      SysconfigStorage.instance.used_fs_list = value
    end

    private

    # Mapping from storage feature to filesystem.
    FEATURE_FILESYSTEM =
      {
        UF_BTRFS:    "btrfs",
        UF_EXT2:     "ext2",
        UF_EXT3:     "ext3",
        UF_EXT4:     "ext4",
        UF_XFS:      "xfs",
        UF_REISERFS: "reiserfs",
        UF_NFS:      "nfs",
        UF_NTFS:     "ntfs",
        UF_VFAT:     "vfat",
        UF_EXFAT:    "exfat",
        UF_F2FS:     "f2fs",
        UF_UDF:      "udf",
        UF_JFS:      "jfs",
        UF_SWAP:     "swap"
      }

    # Get the used filesystems.
    #
    # @return [Array<String>] Used filesystems of the devicegraph.
    def filesystems
      features = @devicegraph.used_features.map(&:id)

      filesystems = []
      FEATURE_FILESYSTEM.each do |feature, filesystem|
        filesystems.append(filesystem) if features.include?(feature)
      end
      filesystems
    end
  end
end
