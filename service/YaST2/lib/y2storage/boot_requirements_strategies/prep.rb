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
require "y2storage/partition_id"

module Y2Storage
  module BootRequirementsStrategies
    # Strategy to calculate boot requirements in systems using PReP
    class PReP < Base
      def initialize(*args)
        super
        textdomain "storage"
      end

      # @see Base#needed_partitions
      def needed_partitions(target)
        planned_partitions = super
        if prep_partition_needed? && prep_partition_missing?
          # Use unshift so PReP goes first (bsc#1076851)
          planned_partitions.unshift(prep_partition(target))
        end
        planned_partitions
      end

      # Boot warnings in the current setup
      #
      # @return [Array<SetupError>]
      def warnings
        res = super

        res.concat(prep_warnings) if prep_partition_needed?

        if boot_partition_needed? && missing_partition_for?(boot_volume)
          res << SetupError.new(missing_volume: boot_volume)
        end

        res
      end

      protected

      # Maximum size firmware can handle
      def max_prep_size
        prep_volume.max_size_limit
      end

      # PReP partition is needed, so return any warning related to it.
      def prep_warnings
        res = []
        big_preps = too_big_preps

        if !big_preps.empty?
          res << SetupError.new(message: big_prep_warning(big_preps))
        elsif missing_partition_for?(prep_volume)
          res << SetupError.new(missing_volume: prep_volume)
        end

        res
      end

      def big_prep_warning(big_partitions)
        # TRANSLATORS: %s is single or list of partitions that are too big.
        msg =
          format(
            n_(
              "The following PReP partition is too big: %s. ",
              "The following PReP partitions are too big: %s.",
              big_partitions.size
            ),
            big_partitions.map(&:name).join(", ")
          )
        # TRANSLATORS: %s is human readable partition size like 8 MiB.
        msg + format(_("Some firmwares can fail to load PReP partitions " \
                       "bigger than %s and thus prevent booting."), max_prep_size)
      end

      def boot_partition_needed?
        # PowerNV uses it's own firmware instead of Grub stage 1, but other
        # PPC systems use regular Grub. Just use the default logic for those.
        return super unless arch.ppc_power_nv?

        # We cannot ensure the mentioned firmware can handle technologies like
        # LVM, MD or LUKS, so propose a separate /boot partition for those cases
        super || (root_in_lvm? || root_in_software_raid? || encrypted_root?)
      end

      def prep_partition_needed?
        # no need of PReP partition in OPAL/PowerNV/Bare metal
        !arch.ppc_power_nv?
      end

      def prep_partition_missing?
        # We don't check if the planned PReP partition is in the boot disk,
        # whoever created it is in control of the details
        current_devices = analyzer.planned_devices + boot_disk.partitions
        current_devices.none? { |d| d.match_volume?(prep_volume) }
      end

      # Select all prep partitions that are too big.
      def too_big_preps
        analyzer.graph_prep_partitions.select do |partition|
          partition.size > max_prep_size
        end
      end

      # @return [VolumeSpecification]
      def prep_volume
        @prep_volume ||= volume_specification_for("prep")
      end

      # @return [Planned::Partition]
      def prep_partition(target)
        planned_partition = create_planned_partition(prep_volume, target)
        planned_partition.bootable = true
        # The PReP partition cannot be logical (see bsc#1082468 and
        # information in /doc and the RSpec tests)
        planned_partition.primary = true
        planned_partition.disk = boot_disk.name
        planned_partition
      end

      def arch
        @arch ||= StorageManager.instance.arch
      end
    end
  end
end
