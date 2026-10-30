# Copyright (c) [2015] SUSE LLC
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
require "y2storage/boot_requirements_strategies/base"
require "y2storage/partition_id"

Yast.import "Arch"

module Y2Storage
  module BootRequirementsStrategies
    # Strategy to calculate the boot requirements in a legacy system (x86 without EFI)
    class Legacy < Base
      def initialize(*args)
        super
        textdomain "storage"
      end

      # @see Base#needed_partitions
      def needed_partitions(target)
        planned_partitions = super
        planned_partitions << grub_partition(target) if grub_partition_needed? && grub_partition_missing?
        planned_partitions
      end

      # Boot warnings in the current setup
      #
      # Note that all are just warnings and we don't trigger real errors so far.
      #
      # @return [Array<SetupError>]
      def warnings
        res = super

        if boot_ptable_type?(:gpt)
          res.concat(errors_on_gpt)
        elsif boot_ptable_type?(:msdos)
          res.concat(errors_on_msdos)
        else
          res.concat(errors_on_plain_disk)
        end

        res
      end

      protected

      # Whether a BIOS GRUB partition will be needed.
      #
      # Note: this is a bit tricky.
      #
      # This function is intended to be used in #needed_partitions while
      # creating a partition proposal. The catch is that when there is no
      # partition table (yet) it is implicitly assumed that there will be a
      # gpt created finally - so a grub partition is needed also in this
      # case.
      #
      # @return [Boolean]
      def grub_partition_needed?
        future_boot_ptable_type?(:gpt) && grub_part_needed_in_gpt?
      end

      # Whether the partition table that will finally be created matches the
      # given type.
      #
      # This is the same as the partition table type if one already exists. Else
      # the check will be against #preferred_ptable_type.
      #
      # FIXME
      #   It seems that a setup with xen virtual partitions (that are in
      #   fact disks) also ends up here. In that case no partition table will
      #   be created (below this case is indicated by boot_disk = nil).
      #   This looks weird.
      #
      # @return [Boolean] true if the partition table matches.
      def future_boot_ptable_type?(type)
        return false if boot_disk.nil?

        if boot_ptable_type?(nil)
          boot_disk.preferred_ptable_type.is?(type)
        else
          boot_ptable_type?(type)
        end
      end

      # Given the fact we are trying to boot from a GPT disk, whether a BIOS
      # BOOT partition is needed in the current setup
      #
      # This always returns true because the usage of such partition is the only
      # method encouraged and documented for Grub2 in a legacy boot environment.
      # https://www.gnu.org/software/grub/manual/grub/grub.html#BIOS-installation
      #
      # In theory, the bootloader could work properly without BIOS BOOT if Grub2
      # is installed in a formatted partition. For that to work, the filesystem
      # must leave space for Grub at the beginning of the partition (like ExtX
      # does) or must support embedding Grub in the filesystem (like Btrfs).
      # But that's a fragile approach that is discouraged by the Grub2
      # developers. In any case, it will not work with XFS since it leaves
      # no space at the beginning of the partition. It wouldn't work for LVM,
      # encryption or RAID either.
      #
      # @return [Boolean] always true, rationale in the method documentation
      def grub_part_needed_in_gpt?
        true
      end

      def grub_partition_missing?
        # We don't check if the planned partition is in the boot disk,
        # whoever created it is in control of the details
        current_devices = analyzer.planned_devices
        current_devices += boot_disk.partitions if boot_disk
        current_devices.none? { |d| d.match_volume?(grub_volume) }
      end

      # Whether /boot is a plain partition and can embed grub
      #
      # @return [Boolean] true if /boot is a plain partition and can embed grub, else false
      def boot_can_embed_grub?
        boot_fs_can_embed_grub? && !(boot_in_lvm? || boot_in_software_raid? || encrypted_boot?)
      end

      # Whether / is a plain partition and can embed grub
      #
      # @return [Boolean] true if / is a plain partition and can embed grub, else false
      def root_can_embed_grub?
        root_fs_can_embed_grub? && !(root_in_lvm? || root_in_software_raid? || encrypted_root?)
      end

      # Whether the MBR gap is big enough for grub
      #
      # @return [Boolean] true if the MBR gap is big enough for grub, else false
      def mbr_gap_for_grub?
        boot_disk.mbr_gap_for_grub?
      end

      # A separate boot partition is needed if
      #   - partition table is msdos and
      #   - the mbr gap is too small for grub and
      #   - grub can't be embedded into the root file system directly
      #
      # Note: this is *not* the bios grub partition.
      #
      # @return [Boolean] true if a separate boot partition is needed, else false
      def boot_partition_needed?
        super || (boot_ptable_type?(:msdos) && !mbr_gap_for_grub? && !root_can_embed_grub?)
      end

      # @return [VolumeSpecification]
      def grub_volume
        @grub_volume ||= volume_specification_for("grub")
      end

      # @return [Planned::Partition]
      def grub_partition(target)
        planned_partition = create_planned_partition(grub_volume, target)
        planned_partition.bootable = false
        planned_partition.disk = boot_disk.name
        planned_partition
      end

      # Boot errors when partition table is gpt
      #
      # @return [Array<SetupError>]
      def errors_on_gpt
        errors = []

        if include_bios_boot_warning?
          errors << bios_boot_missing_error
          errors << grub_embedding_error
        end

        errors
      end

      # Boot errors when partition table is msdos
      #
      # @return [Array<SetupError>]
      def errors_on_msdos
        errors = []

        if !mbr_gap_for_grub?
          errors << mbr_gap_error
          errors << grub_embedding_error
        end

        errors
      end

      # Boot errors when there's no partition table
      #
      # @return [Array<SetupError>]
      def errors_on_plain_disk
        errors = []

        errors << no_boot_partition_table_error
        errors << grub_embedding_error

        errors
      end

      # Check if boot disk can embed grub and return appropriate message
      #
      # @return [SetupError]
      def grub_embedding_error
        if boot_can_embed_grub?
          bad_config_warning
        else
          bad_config_error
        end
      end

      # Specific error when the boot disk has no partition table
      #
      # @return [SetupError]
      def no_boot_partition_table_error
        # TRANSLATORS: error message
        error_message = _(
          "Boot disk has no partition table."
        )
        SetupError.new(message: error_message)
      end

      # Specific error when the MBR gap is small
      #
      # @return [SetupError]
      def mbr_gap_error
        # TRANSLATORS: error message; %s is a human readable disk size like 256 KiB
        error_message = format(
          _(
            "Not enough space before the first partition to install the bootloader. " \
            "Leave at least %s."
          ),
          PartitionTables::Msdos::MBR_GAP_GRUB_LIMIT.to_human_string
        )
        SetupError.new(message: error_message)
      end

      # Specific error when BIOS GRUB partition is missing
      #
      # @return [SetupError]
      def bios_boot_missing_error
        # TRANSLATORS: %s is a partition type, e.g. "BIOS Boot"
        message = format(
          _("A partition of type %s is needed to install the bootloader."),
          PartitionId::BIOS_BOOT.to_human_string
        )
        SetupError.new(message: message)
      end

      # Specific warning when the current setup is not supported
      #
      # @return [SetupError]
      def bad_config_warning
        message = _(
          "Such a setup is not supported and may cause problems " \
          "with the bootloader now or in the future."
        )
        SetupError.new(message: message)
      end

      # Specific error when we are quite sure the current setup will not work
      #
      # @return [SetupError]
      def bad_config_error
        message = _(
          "It will not be possible to install the bootloader."
        )
        SetupError.new(message: message)
      end

      # Whether the warning about missing BIOS Boot partition should be included
      #
      # return [Boolean] true when a needed Grub partition is missing, unless running in a XEN domU
      def include_bios_boot_warning?
        return false if Yast::Arch.is_xenU

        grub_part_needed_in_gpt? && missing_partition_for?(grub_volume)
      end
    end
  end
end
