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

require "y2storage/boot_requirements_strategies/base"

module Y2Storage
  module BootRequirementsStrategies
    # Strategy to calculate boot requirements in systems using ZIPL
    class ZIPL < Base
      def initialize(*args)
        super
        textdomain "storage"
      end

      # @see Base#needed_partitions
      def needed_partitions(target)
        raise Error, "Impossible to boot system from the chosen disk" unless supported_boot_disk?

        if zipl_partition_needed? && zipl_partition_missing?
          [zipl_partition(target)]
        else
          []
        end
      end

      # Boot warnings in the current setup
      #
      # @return [Array<SetupError>]
      def warnings
        res = super

        if !supported_boot_disk?
          res << unsupported_boot_disk_error
        elsif zipl_partition_needed? && missing_partition_for?(zipl_volume)
          res << SetupError.new(missing_volume: zipl_volume)
        end

        res
      end

      protected

      def supported_boot_disk?
        return false unless boot_disk
        return false if boot_disk.is?(:dasd) && boot_disk.format.is?(:ldl)

        # TODO: DIAG disks (whatever they are) are not supported either

        true
      end

      def zipl_partition_missing?
        free_mountpoint?("/boot/zipl")
      end

      # Whether a separate /boot/zipl partition is needed to boot the planned
      # setup
      #
      # @return [Boolean]
      def zipl_partition_needed?
        # We cannot ensure the s390 firmware can handle technologies like LVM,
        # MD or LUKS, so propose a separate /boot/zipl partition for those cases
        return true if boot_in_lvm? || boot_in_software_raid? || encrypted_boot?

        # In theory, this is never called if there is no / filesystem (planned or
        # current). But let's stay safe and return false right away.
        return false if boot_filesystem_type.nil?

        # The s390 firmware can find the kernel if the partition holding it uses
        # one of the supported filesystem types
        !boot_filesystem_type.zipl_ok?
      end

      # @return [VolumeSpecification]
      def zipl_volume
        @zipl_volume ||= volume_specification_for("/boot/zipl")
      end

      # @return [Planned::Partition]
      def zipl_partition(target)
        planned_partition = create_planned_partition(zipl_volume, target)
        planned_partition.disk = boot_disk.name
        planned_partition
      end

      # Specific error when the boot disk is not valid for booting
      #
      # @return [SetupError]
      def unsupported_boot_disk_error
        # TRANSLATORS: error message
        error_message = _(
          "Looks like the system is going to be installed on an LDL device.\n" \
          "Booting from such device is not supported."
        )
        SetupError.new(message: error_message)
      end

      # Whether the grub partition is readable
      #
      # Even if the /boot partition is encrypted using a technology different from
      # LUKS1, it is possible to read it if theres is an unencrypted zipl partition.
      #
      # /boot/zipl contains a kernel that will take care of activating the device containing
      # /boot, so Grub will find it accessible.
      #
      # @see Base#boot_readable_by_grub?
      def boot_readable_by_grub?
        return true if super

        analyzer.device_for_zipl && !analyzer.encrypted_zipl?
      end
    end
  end
end
