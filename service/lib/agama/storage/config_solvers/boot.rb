# frozen_string_literal: true

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
        def solve_device_alias
          return unless config.boot.configure? && config.boot.device.default?

          drive_config = root_drive_config
          return unless drive_config

          drive_config.ensure_alias
          config.boot.device.device_alias = drive_config.alias
        end

        # Config of the drive used for allocating root, directly or inderectly.
        #
        # @return [Configs::Drive, nil] nil if the boot device cannot be inferred from the config.
        def root_drive_config
          drive_config = config.drives.find { |d| root_drive_config?(d) }

          drive_config || root_lvm_device_config
        end

        # Config of the first drive used to allocate the root volume group config, if any.
        #
        # @return [Configs::Drive, nil]
        def root_lvm_device_config
          volume_group_config = root_volume_group_config
          return unless volume_group_config

          config.drives
            .select { |d| candidate_for_physical_volumes?(d, volume_group_config) }
            .first
        end

        # Config of the volume group containing the root logical volume, if any.
        #
        # @return [Configs::VolumeGroup, nil]
        def root_volume_group_config
          config.volume_groups.find { |v| root_volume_group_config?(v) }
        end

        # Whether the given drive config contains a root partition config.
        #
        # @param config [Configs::Drive]
        # @return [Boolean]
        def root_drive_config?(config)
          config.partitions.any? { |p| root_config?(p) }
        end

        # Whether the given volume group config contains a root logical volume config.
        #
        # @param config [Configs::VolumeGroup]
        # @return [Boolean]
        def root_volume_group_config?(config)
          config.logical_volumes.any? { |l| root_config?(l) }
        end

        # Whether the given config if for the root filesystem.
        #
        # @param config [#filesystem]
        # @return [Boolean]
        def root_config?(config)
          config.filesystem&.root?
        end

        # Whether the given drive config can be used to allocate physcial volumes.
        #
        # @param drive [Configs::Drive]
        # @param volume_group [Configs::VolumeGroup]
        #
        # @return [Boolean]
        def candidate_for_physical_volumes?(drive, volume_group)
          return true if volume_group.physical_volumes_devices.any? { |d| drive.alias?(d) }

          volume_group.physical_volumes.any? do |pv|
            drive.partitions.any? { |p| p.alias?(pv) }
          end
        end
      end
    end
  end
end
