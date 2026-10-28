# Copyright (c) [2018] SUSE LLC
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
require "y2storage/partition_tables/base"

module Y2Storage
  module PartitionTables
    # Class to represent an implicit partition table. An implicit partition
    # table does not exist on-disk so no operations are possible. It is
    # present on some DASDs where the kernel creates a partition all by
    # itself.
    #
    # https://github.com/openSUSE/libstorage-ng/blob/master/doc/dasd.md
    #
    # This is a wrapper for Storage::ImplicitPt
    class ImplicitPt < Base
      wrap_class Storage::ImplicitPt

      # Single partition of an implicit partition table
      #
      # @note The kernel creates a partition on some DASDs even though no
      #   partition table exists on-disk. This situation is represented in
      #   libstorage-ng by an implicit partition table having one partition.
      #
      # @raise [Y2Storage::Error] if there is no partition
      # @return [Y2Storage::Partition]
      def partition
        raise Error, "Implicit partition table must have one partition" if partitions.empty?

        partitions.first
      end

      # Free spaces in the implicit partition table
      #
      # @note The single partition cannot be removed. The whole partition is
      #   considered as free space when it is not in use (has no filesystem,
      #   is not an LVM PV, and is not part of a software RAID).
      #
      # @see FreeDiskSpace
      #
      # @return [Array<Y2Storage::FreeDiskSpace>] empty if the partition is
      #   in use.
      def free_spaces
        return [] if partition.has_children?

        [FreeDiskSpace.new(partitionable, partition.region)]
      end
    end
  end
end
