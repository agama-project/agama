# Copyright (c) [2024] SUSE LLC
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
    # Strategy to calculate boot requirements in BLS/UEFI systems
    class BLS < UEFI
      def initialize(*args)
        textdomain "storage"
        super
      end

      # No extra /boot partition which is needed by grub2 only
      def needed_partitions(target)
        planned_partitions = []
        planned_partitions << efi_partition(target) if efi_missing?
        planned_partitions
      end

      # Checks if it makes sense to show grub warnings
      #
      # @return [Boolean]
      def grub_warning?
        false
      end

      protected

      # @return [VolumeSpecification]
      def efi_volume
        if @efi_volume.nil?
          @efi_volume = volume_specification_for("/boot/efi")
          # BLS suggests 1GiB for boot partition
          # https://uapi-group.org/specifications/specs/boot_loader_specification/
          @efi_volume.min_size = DiskSize.MiB(512)
          @efi_volume.desired_size = DiskSize.GiB(1)
          @efi_volume.max_size = DiskSize.GiB(1)
        end
        @efi_volume
      end
    end
  end
end
