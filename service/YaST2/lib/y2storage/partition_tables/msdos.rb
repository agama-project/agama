# Copyright (c) [2017] SUSE LLC
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
require "y2storage/disk_size"

module Y2Storage
  module PartitionTables
    # A MBR partition table
    #
    # This is a wrapper for Storage::Msdos
    class Msdos < Base
      wrap_class Storage::Msdos

      # Minimal value that makes sense for {#minimal_mbr_gap}.
      #
      # Trying to allocate a partition before the first 512 bytes makes no
      # sense, since that space is used by the Master Boot Code and the
      # partition table itself.
      #
      # @see #minimal_mbr_gap
      # @see #mbr_gap
      #
      # @return [DiskSize]
      LOWER_MBR_GAP_LIMIT = DiskSize.B(512).freeze
      private_constant :LOWER_MBR_GAP_LIMIT

      # MBR_GAP_GRUB_LIMIT covers the size needed for embedding the grub image.
      #
      # The value is not exact (it depends on the grub modules needed to
      # access the /boot partition [raid, lvm, encryption, ...]) but is
      # chosen big enough to be on the safe side.
      MBR_GAP_GRUB_LIMIT = DiskSize.KiB(256).freeze

      # Default value used by libstorage-ng to set the minimal MBR grap
      #
      # This is equivalent to the static const default_minimal_mbr_gap that is
      # used internally in Storage::Msdos but not exposed in the API.
      DEFAULT_MBR_GAP = DiskSize.MiB(1).freeze
      private_constant :DEFAULT_MBR_GAP

      # @!attribute minimal_mbr_gap
      #   Minimal possible size of the so-called MBR gap. In other words, at
      #   which distance from the start of the disk should the first partition
      #   be allocated.
      #
      #   @see #mbr_gap
      #
      #   @return [DiskSize]
      storage_forward :minimal_mbr_gap, as: "DiskSize"
      storage_forward :minimal_mbr_gap=

      # Current MBR gap
      #
      # The MBR gap is the space between the beginning of the disk (i.e.
      # the beginning of the MBR) and the beginning of the first partition.
      # This space includes the Master Boot Code, the partition table and
      # the gap afterwards (often used by the bootloader).
      #
      # There is no equivalent in GPT partition tables (where BIOS boot
      # partitions are used to allocate the bootloader instead of the MBR).
      #
      # If there are no partitions nil is returned, meaning "gap not
      # applicable" which is different from "no gap" (i.e. a 0 bytes gap).
      # In fact, due to the space needed by the Master Boot Code and the
      # partition table itself, the gap should never be smaller than
      # 512 bytes.
      #
      # @return [DiskSize, nil]
      def mbr_gap
        return nil if partitions.empty?

        region1 = partitions.min { |x, y| x.region.start <=> y.region.start }
        region1.region.block_size * region1.region.start
      end

      # Whether the MBR gap is big enough for grub
      #
      # If the mbr_gap is nil this means there are no partitions. This is also ok.
      #
      # @return [Boolean] true if the MBR gap is big enough for grub, else false
      def mbr_gap_for_grub?
        !mbr_gap || mbr_gap >= MBR_GAP_GRUB_LIMIT
      end

      # Sets {#minimal_mbr_gap} to the lower acceptable value
      def reduce_minimal_mbr_gap
        self.minimal_mbr_gap = LOWER_MBR_GAP_LIMIT
      end

      # Default value used by libstorage-ng to set {#minimal_mbr_gap}
      #
      # @return [DiskSize]
      def self.default_mbr_gap
        DEFAULT_MBR_GAP.dup
      end
    end
  end
end
