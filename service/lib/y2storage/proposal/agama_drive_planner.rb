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
      # @param settings [Agama::Storage::Configs::Drive]
      # @return [Array<Planned::Device>]
      def planned_devices(settings)
        [planned_drive(settings)]
      end

    private

      # Support for StrayBlkDevice is intentionally left out. As far as we know, the plan
      # for SLE/Leap 16 is to drop XEN support
      #
      # @param settings [Agama::Storage::Configs::Drive]
      # @return [Planned::Disk]
      def planned_drive(settings)
        return planned_full_drive(settings) unless settings.partitions?

        planned_partitioned_drive(settings)
      end

      # @param settings [Agama::Storage::Configs::Drive]
      # @return [Planned::Disk]
      def planned_full_drive(settings)
        Planned::Disk.new.tap do |planned|
          configure_reuse(planned, settings)
          configure_block_device(planned, settings)
        end
      end

      # @param settings [Agama::Storage::Configs::Drive]
      # @return [Planned::Disk]
      def planned_partitioned_drive(settings)
        Planned::Disk.new.tap do |planned|
          configure_reuse(planned, settings)
          configure_partitions(planned, settings)
        end
      end
    end
  end
end
