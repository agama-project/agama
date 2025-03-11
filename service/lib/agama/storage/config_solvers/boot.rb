# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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

require "agama/storage/config_solvers/base"

module Agama
  module Storage
    module ConfigSolvers
      # Solver for the boot config.
      class Boot < Base
        # Solves the boot config within a given config.
        #
        # @note The config object is modified.
        #
        # @param config [Config]
        def solve(config)
          @config = config
          solve_device_alias
        end

      private

        # Finds a device for booting and sets its alias, if needed.
        #
        # A boot device cannot be automatically inferred in the following scenarios:
        #   * The root partition or logical volume is missing.
        #   * A disk is directly formated and mounted as root.
        #   * The volume group allocating the root logical volume uses whole drives as physical
        #     volumes.
        def solve_device_alias
          return unless config.boot.configure? && config.boot.device.default?

          drive = root_drive
          return unless drive

          drive.ensure_alias
          config.boot.device.device_alias = drive.alias
        end

        # Config of the drive used for allocating root, directly or inderectly.
        #
        # @return [Configs::Drive, nil] nil if the boot device cannot be inferred from the config.
        def root_drive
          drive = config.drives.find { |d| root_drive?(d) }
          drive || root_lvm_device
        end

        # Config of the first drive used for allocating the physical volumes of the root volume
        # group.
        #
        # @return [Configs::Drive, nil]
        def root_lvm_device
          volume_group = root_volume_group
          return unless volume_group

          first_target_lvm_device(volume_group) || first_physical_volume_device(volume_group)
        end

        # Config of the volume group containing the root logical volume, if any.
        #
        # @return [Configs::VolumeGroup, nil]
        def root_volume_group
          config.volume_groups.find { |v| root_volume_group?(v) }
        end

        # Whether the given drive config contains a root partition config.
        #
        # @param config [Configs::Drive]
        # @return [Boolean]
        def root_drive?(config)
          config.partitions.any?(&:root?)
        end

        # Whether the given volume group config contains a root logical volume config.
        #
        # @param config [Configs::VolumeGroup]
        # @return [Boolean]
        def root_volume_group?(config)
          config.logical_volumes.any?(&:root?)
        end

        # Config of the first target device for creating physical volumes.
        #
        # @param config [Configs::VolumeGroup]
        # @return [Configs::Drive, nil]
        def first_target_lvm_device(config)
          device_alias = config.physical_volumes_devices.first
          return unless device_alias

          self.config.drives.find { |d| d.alias?(device_alias) }
        end

        # Config of the device of the first partition used as physical volume.
        #
        # @param config [Configs::VolumeGroup]
        # @return [Configs::Drive, nil]
        def first_physical_volume_device(config)
          device_alias = config.physical_volumes.find { |p| partition_alias?(p) }
          return unless device_alias

          self.config.drives.find do |drive|
            drive.partitions.any? { |p| p.alias?(device_alias) }
          end
        end

        # Whether there is a partition with the given alias.
        #
        # @param device_alias [String]
        # @return [Boolean]
        def partition_alias?(device_alias)
          config.partitions.any? { |p| p.alias?(device_alias) }
        end
      end
    end
  end
end
