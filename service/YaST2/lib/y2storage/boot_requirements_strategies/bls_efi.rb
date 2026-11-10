# Copyright (c) [2026] SUSE LLC
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
    # Strategy to calculate boot requirements following the BLS specification described
    # at https://uapi-group.org/specifications/specs/boot_loader_specification/
    #
    # With some modifications agreed on https://jira.suse.com/browse/PED-10703
    #
    # TODO: So far, this only covers GPT partition table
    class BlsEfi < UEFI
      def initialize(*args)
        textdomain "storage"
        super
      end

      # @see Base#needed_partitions
      def needed_partitions(target)
        assign_configured_boot_ids
        planned_partitions = []
        planned_partitions << esp_partition(target) unless esp_configured?
        if !boot_configured? && xbootldr_needed?(planned_partitions)
          planned_partitions << xbootldr_partition(target)
        end
        planned_partitions
      end

      # @see Base#warnings
      #
      # The checks from the base class are all about ensuring the bootloader can read the kernel
      # from '/boot'. But with BLS the kernel is directly located at the ESP or XBOOTLDR partitions,
      # so those checks are not longer necessary.
      #
      # The checks from the superclass UEFI may also need to be re-evaluated. Let's skip them for
      # now.
      #
      # @return [Array<SetupError>]
      def warnings
        []
      end

      # @see Base#errors
      #
      # The base class checks for two errors: no '/' and too small '/boot'. But this is the only
      # strategy in which the kernel may not be in '/boot', so we need to redefine the method to
      # remove that second check.
      #
      # @return [Array<SetupError>]
      def errors
        return [no_root_error] if root_filesystem_missing?

        []
      end

      protected

      # Ids to be assigned to the planned partitions without partition id that are mounted at
      # a boot mount point, except for /boot (see {#assign_configured_boot_ids}).
      #
      # @see UEFI#configured_boot_ids
      #
      # @return [Hash{String => PartitionId}]
      def configured_boot_ids
        { "/boot/efi" => PartitionId::ESP, "/efi" => PartitionId::ESP }
      end

      # Sets the partition id of the planned partitions mounted at a boot mount point and without
      # partition id.
      #
      # In addition to the ids set by the superclass, a partition mounted at /boot gets the id that
      # the partition would have if it was automatically proposed, see {#boot_partition_id}.
      #
      # @see UEFI#assign_configured_boot_ids
      def assign_configured_boot_ids
        return unless assign_boot_ids?

        super
        planned_partitions_at("/boot").each do |planned|
          planned.partition_id ||= boot_partition_id(planned)
        end
      end

      # Id for a planned partition mounted at /boot
      #
      # It follows the logic used to propose the boot partitions:
      #
      # * If there is no ESP at /efi or /boot/efi and the partition is big enough to be the ESP,
      #   the partition is the ESP (the ESP would be proposed at /boot).
      # * Otherwise, the partition is an XBOOTLDR partition: either the ESP is somewhere else, or
      #   the partition is too small to be the ESP and the ESP would be proposed at /efi.
      #
      # @param planned [Planned::Partition]
      # @return [PartitionId]
      def boot_partition_id(planned)
        return PartitionId::XBOOTLDR if esp_mount_point_configured?
        return PartitionId::XBOOTLDR if min_planned_size(planned) < esp_min_size

        PartitionId::ESP
      end

      # Whether there is something mounted at /efi or /boot/efi
      #
      # @return [Boolean]
      def esp_mount_point_configured?
        !free_mountpoint?("/efi") || !free_mountpoint?("/boot/efi")
      end

      # Whether the ESP partition is already part of the initial configuration
      #
      # If the ids of the boot partitions are assigned (see {#assign_boot_ids?}), the partitions
      # configured for /efi and /boot/efi are considered to be the ESP regardless of their
      # partition id. The user is free to decide the id of a boot partition, no extra ESP is
      # proposed (and no duplicated mount point is generated). Otherwise, only the partitions with
      # the ESP id are considered.
      #
      # A partition configured for /boot is only considered to be the ESP if it has the ESP id
      # (explicit or assigned, see {#boot_partition_id}), otherwise an ESP is still needed.
      #
      # @return [Boolean]
      def esp_configured?
        return true if configured_esp_planned_partition || configured_esp_partition
        return false unless assign_boot_ids?

        esp_mount_point_configured?
      end

      # Partition from the devicegraph configured to be used as ESP, if any
      #
      # @return [Y2Storage::Partition, nil]
      def configured_esp_partition
        # There should be only zero or one
        boot_disk.partitions.find { |p| p.id == PartitionId::ESP && p.filesystem_mountpoint }
      end

      # Partition from the initial list of planned partitions configured to be used as ESP, if any
      #
      # @return [Planned::Partition, nil]
      def configured_esp_planned_partition
        # There should be only zero or one
        analyzer.planned_esp_partitions.find(&:mount_point)
      end

      # Whether a separate /boot mount point is already configured
      #
      # @return [Boolean]
      def boot_configured?
        !free_mountpoint?("/boot")
      end

      # Whether a XBOOTLDR partition would be needed
      #
      # @return [Boolean]
      def xbootldr_needed?(planned_partitions)
        planned = planned_partitions.first || configured_esp_planned_partition
        if planned
          xbootldr_for_efi?(planned.mount_point, min_planned_size(planned))
        else
          partition = configured_esp_partition
          if partition
            xbootldr_for_efi?(partition.filesystem_mountpoint, partition.size)
          else
            false
          end
        end
      end

      # @see xbootldr_needed?
      #
      # @param mount_point [String] path of the ESP partition
      # @param size [DiskSize] size of the ESP partition
      def xbootldr_for_efi?(mount_point, size)
        mount_point == "/efi" && size < esp_min_size
      end

      # @return [Planned::Partition]
      def esp_partition(target)
        planned = efi_partition(target)
        planned.mount_point = "/boot" if min_planned_size(planned) >= esp_min_size && !boot_configured?

        planned
      end

      # @return [Planned::Partition]
      def xbootldr_partition(target)
        planned = create_planned_partition(efi_volume, target)
        planned.mount_point = "/boot"
        planned.partition_id = PartitionId::XBOOTLDR

        if reusable_xbootldr
          planned.assign_reuse(reusable_xbootldr)
        else
          planned.disk = boot_disk.name
        end

        planned
      end

      # Partition in the boot disk that can be re-used to setup XBOOTLDR
      #
      # @return [Y2Storage::Partitioner]
      def reusable_xbootldr
        @reusable_xbootldr ||= biggest_efi_in_boot_device(PartitionId::XBOOTLDR)
      end

      # Min size an ESP partition must have to be self-sufficient (ie. to not need an extra XBOOTLDR
      # partition)
      #
      # @return [DiskSize]
      def esp_min_size
        efi_volume.min_size
      end

      # @return [VolumeSpecification]
      def efi_volume
        volume_specification_for("/efi")
      end

      # Min size for the given planned partition
      #
      # @param planned [Planned::Partition]
      # @return [DiskSize]
      def min_planned_size(planned)
        return planned.min_size unless planned.reuse?

        devicegraph.find_device(planned.reuse_sid).size
      end
    end
  end
end
