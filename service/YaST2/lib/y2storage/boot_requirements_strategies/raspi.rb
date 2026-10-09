# Copyright (c) [2018-2019] SUSE LLC
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

require "y2storage/boot_requirements_strategies/uefi"

module Y2Storage
  module BootRequirementsStrategies
    # Strategy to calculate boot requirements for Raspberry Pi (a.k.a. raspi)
    # systems
    #
    # (open)SUSE approach for booting Raspberry Pi devices is using a firmware
    # located in the first partition of the disk that makes the raspi basically
    # work as a normal PC-like UEFI system. For details, see fate#323484 and
    # https://www.suse.com/media/article/UEFI_on_Top_of_U-Boot.pdf
    #
    # So this is just a special case of UEFI boot in which the firmware
    # partition must be kept (and mounted to allow updating its content) or
    # created. In both cases, the ESP partition can be used to allocate the
    # firmware, so a completely dedicated partition is not always needed.
    class Raspi < UEFI
      # Path where the dedicated firmware partition, if any, should be mounted
      FIRMWARE_MOUNT_PATH = "/boot/vc".freeze
      private_constant :FIRMWARE_MOUNT_PATH

      # Partition id that must be used in the first partition. Otherwise,
      # Raspberry Pi will not recognize it as a valid partition to boot from.
      BOOT_PARTITION_ID = Y2Storage::PartitionId::DOS32
      private_constant :BOOT_PARTITION_ID

      # Constructor, see base class
      def initialize(*args)
        textdomain "storage"
        super
      end

      # @see Base#needed_partitions
      def needed_partitions(target)
        planned_partitions = []

        if boot_partition
          if efi_in_boot_partition?
            @reusable_efi = boot_partition
          elsif firmware_in_boot_partition? && !mounted_firmware?
            @reusable_firmware_partition = boot_partition
            planned_partitions << planned_firmware
            @reusable_efi = biggest_efi_in_boot_device
          end
        end

        planned_partitions << efi_partition(target) if efi_missing?
        planned_partitions
      end

      protected

      # @return [Partition, nil] existing partition that must be reused as /boot/efi,
      #   nil if there is no such partition or whether the existing one(s) cannot be
      #   used to boot
      attr_reader :reusable_efi

      # @return [Partition, nil] existing partition dedicated only to store the
      #   booting firmware and associated files, nil if there is no such partition
      attr_reader :reusable_firmware_partition

      # Existing partition from which Raspberry Pi would try to load the bootcode,
      # if any
      #
      # According to fate#323484 and to the "UEFI on Top of U-Boot" paper
      # (https://www.suse.com/media/article/UEFI_on_Top_of_U-Boot.pdf),
      # the Raspberry Pi boot code resides in a file called "bootcode.bin" that
      # is placed in the first partition of a partition table of type MBR. That
      # partition must be of type DOS32 (id 0xC) and formatted as VFAT.
      #
      # @return [Partition, nil] nil if the boot disk contains no partition that
      #   could be used for booting
      def boot_partition
        return @boot_partition if @boot_partition_calculated

        @boot_partition_calculated = true
        @boot_partition = boot_partition_in(boot_disk)
      end

      # Whether the boot partition contains a Raspberry Pi boot code.
      #
      # @return [Boolean]
      def firmware_in_boot_partition?
        return false if boot_partition.nil?

        @firmware_in_boot_partition ||= boot_partition.filesystem.rpi_boot?
      end

      # Whether the boot partition contains the directories layout of an ESP
      # partition
      #
      # @return [Boolean]
      def efi_in_boot_partition?
        return false if boot_partition.nil?

        # Calling suitable_efi_partition?(boot_partition) would not work here because
        # that relies on the partition id instead of the content. But our method to
        # boot Raspberry Pi does not exactly follow the EFI standards.
        @efi_in_boot_partition ||= boot_partition.filesystem.efi?
      end

      # Planned partition to reuse the existing dedicated firmware partition
      #
      # @return [Planned::Partition, nil] nil if there is no firmware partition to reuse.
      def planned_firmware
        return nil unless reusable_firmware_partition

        planned = Planned::Partition.new(FIRMWARE_MOUNT_PATH)
        planned.assign_reuse(reusable_firmware_partition)
        planned
      end

      # See {UEFI#efi_partition}, this overrides the method in the parent class
      # with some small differences between a standard EFI partition and the
      # Raspberry Pi version of it
      #
      # @return [Planned::Partition]
      def efi_partition(_target)
        planned = super
        # raspi-specific modifications of the standard EFI partition are only
        # needed if the EFI partition is going to be created (not reused) and
        # there is not a dedicated separate partition for the firmware
        return planned if reusable_firmware_partition || planned.reuse?

        planned.ptable_type = PartitionTables::Type::MSDOS
        planned.partition_id = BOOT_PARTITION_ID
        planned.max_start_offset = max_offset_for_first_partition
        planned
      end

      # Value to be used in {Planned::Partition#max_start_offset} to ensure the
      # created partition is the first of the disk
      #
      # @return [DiskSize]
      def max_offset_for_first_partition
        # This should be enough in the case of a Raspberry Pi. It makes no sense
        # to introduce more complicated logic to support devices with strange
        # topologies that will never be used in a Pi.
        PartitionTables::Msdos.default_mbr_gap
      end

      # Whether there is already a partition configured to be used as separate
      # firmware partition
      #
      # @return [Boolean]
      def mounted_firmware?
        !free_mountpoint?(FIRMWARE_MOUNT_PATH)
      end

      # @see #boot_partition
      #
      # @return [Partition, nil]
      def boot_partition_in(disk)
        return nil unless msdos_ptable?(disk)

        first = disk.partitions.min_by { |p| p.region.start }
        return nil if first.nil? || first.id != BOOT_PARTITION_ID

        filesystem = first.direct_blk_filesystem
        return nil if filesystem.nil? || !filesystem.type.is?(:vfat)

        first
      end

      # Whether the disk contains an MS-DOS style (a.k.a. MBR) partition table
      #
      # @param disk [Partitionable]
      # @return [Boolean] false if there is no partition table or if there is
      #   one of the wrong type
      def msdos_ptable?(disk)
        disk.partition_table&.type&.is?(:msdos)
      end
    end
  end
end
