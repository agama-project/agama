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
        #   * The MD RAID allocating root uses whole drives as member devices.
        def solve_device_alias
          return unless config.boot.configure? && config.boot.device.default?

          device = boot_device
          return unless device

          device.ensure_alias
          config.boot.device.device_alias = device.alias
        end

        # Config of the device used for allocating root, directly or inderectly.
        #
        # The boot device has to be a partitioned drive. If root is not directly created as a
        # partition of a drive (e.g., as logical volume, as partition of a MD RAID, etc), then the
        # first partitioned drive used for allocating the device (physcical volume or MD member
        # device) is considered as boot device.
        #
        # The boot device is recursively searched until reaching a drive.
        #
        # @return [Configs::Drive, nil] nil if the boot device cannot be inferred from the config.
        def boot_device
          root_device = config.root_drive || config.root_md_raid || config.root_volume_group
          return unless root_device

          partitioned_drive_from_device(root_device)
        end

        # Recursively looks for the first partitioned drive from the given list of devices.
        #
        # @param devices [Array<Configs::Drive, Configs::MdRaid, Configs::VolumeGroup>]
        # @param is_target [Boolean] Whether the devices are target for automatically creating
        #   partitions (e.g., for creating physical volumes).
        #
        # @return [Configs::Drive, nil]
        def partitioned_drive_from_devices(devices, is_target: false)
          devices.each do |device|
            drive = partitioned_drive_from_device(device, is_target: is_target)
            return drive if drive
          end

          nil
        end

        # Recursively looks for the first partitioned drive from the given device.
        #
        # @param device [Configs::Drive, Configs::MdRaid, Configs::VolumeGroup]
        # @param is_target [Boolean] See {#partitioned_drive_from_devices}
        #
        # @return [Configs::Drive, nil]
        def partitioned_drive_from_device(device, is_target: false)
          case device
          when Configs::Drive
            (device.partitions? || is_target) ? device : nil
          when Configs::MdRaid
            partitioned_drive_from_md_raid(device)
          when Configs::VolumeGroup
            partitioned_drive_from_volume_group(device)
          end
        end

        # Recursively looks for the first partitioned drive from the given MD RAID.
        #
        # @param md_raid [Configs::MdRaid]
        # @return [Configs::Drive, nil]
        def partitioned_drive_from_md_raid(md_raid)
          devices = find_devices(md_raid.devices)
          partitioned_drive_from_devices(devices)
        end

        # Recursively looks for the first partitioned drive from the given volume group.
        #
        # @param volume_group [Configs::VolumeGroup]
        # @return [Configs::Drive, nil]
        def partitioned_drive_from_volume_group(volume_group)
          pv_devices = find_devices(volume_group.physical_volumes_devices, is_target: true)
          pvs = find_devices(volume_group.physical_volumes)

          partitioned_drive_from_devices(pv_devices, is_target: true) ||
            partitioned_drive_from_devices(pvs)
        end

        # Finds the devices with the given aliases or containing the given aliases.
        #
        # @param aliases [Array<String>]
        # @param is_target [Boolean] See {#partitioned_drive_from_devices}
        #
        # @return [Array<Configs::Drive, Configs::MdRaid, Configs::VolumeGroup>]
        def find_devices(aliases, is_target: false)
          aliases.map { |a| find_device(a, is_target: is_target) }.compact
        end

        # Finds the device with the given alias or containing the given alias.
        #
        # @param device_alias [String]
        # @param is_target [Boolean] See {#partitioned_drive_from_devices}
        #
        # @return [Configs::Drive, Configs::MdRaid, Configs::VolumeGroup, nil]
        def find_device(device_alias, is_target: false)
          find_drive(device_alias, is_target: is_target) ||
            find_md_raid(device_alias) ||
            find_volume_group(device_alias)
        end

        # Finds the drive with the given alias or containing a partition with the given alias.
        #
        # @note If the alias points to a drive instead of a partition and the drive is directly used
        #   (i.e., the drive is not used as target), then the drive is not found. Directly used
        #   drives (without partitioning) cannot be proposed as boot device.
        #
        # @param device_alias [String]
        # @param is_target [Boolean] See {#partitioned_drive_from_devices}
        #
        # @return [Configs::Drive, nil]
        def find_drive(device_alias, is_target: false)
          drive = is_target ? config.drive(device_alias) : nil
          drive || config.drives.find { |d| d.partition?(device_alias) }
        end

        # Finds the MD RAID with the given alias or containing a partition with the given alias.
        #
        # @param device_alias [String]
        # @return [Configs::MdRaid, nil]
        def find_md_raid(device_alias)
          config.md_raid(device_alias) || config.md_raids.find { |d| d.partition?(device_alias) }
        end

        # Finds the volume group containing a logical volume with the given alias.
        #
        # @param device_alias [String]
        # @return [Configs::VolumeGroup, nil]
        def find_volume_group(device_alias)
          config.volume_groups.find { |v| v.logical_volume?(device_alias) }
        end
      end
    end
  end
end
