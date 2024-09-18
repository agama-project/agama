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

require "y2storage/planned/disk"
require "y2storage/proposal/agama_device_planner"

module Y2Storage
  module Proposal
    # Drive planner for Agama.
    class AgamaDrivePlanner < AgamaDevicePlanner
      # @param drive_config [Agama::Storage::Configs::Drive]
      # @param config [Agama::Storage::Config]
      #
      # @return [Array<Planned::Device>]
      def planned_devices(drive_config, config)
        return [] if drive_config.search&.skip_device?

        [planned_drive(drive_config, config)]
      end

    private

      # Support for StrayBlkDevice is intentionally left out. As far as we know, the plan
      # for SLE/Leap 16 is to drop XEN support
      #
      # @param drive_config [Agama::Storage::Configs::Drive]
      # @param config [Agama::Storage::Config]
      #
      # @return [Planned::Disk]
      def planned_drive(drive_config, config)
        return planned_full_drive(drive_config, config) unless drive_config.partitions?

        planned_partitioned_drive(drive_config, config)
      end

      # @param drive_config [Agama::Storage::Configs::Drive]
      # @param config [Agama::Storage::Config]
      #
      # @return [Planned::Disk]
      def planned_full_drive(drive_config, config)
        Planned::Disk.new.tap do |planned|
          configure_reuse(planned, drive_config)
          configure_block_device(planned, drive_config)
          configure_pv(planned, drive_config, config)
        end
      end

      # @param drive_config [Agama::Storage::Configs::Drive]
      # @param config [Agama::Storage::Config]
      #
      # @return [Planned::Disk]
      def planned_partitioned_drive(drive_config, config)
        Planned::Disk.new.tap do |planned|
          configure_reuse(planned, drive_config)
          configure_partitions(planned, drive_config, config)
        end
      end
    end
  end
end
