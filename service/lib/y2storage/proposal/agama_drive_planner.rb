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

module Y2Storage
  module Proposal
    class AgamaDrivePlanner < AgamaDevicePlanner
      # @param settings [Agama::Storage::Settings::Drive]
      # @return [Array<Planned::Device>]
      def planned_devices(settings)
        [planned_drive(settings)]
      end

      private

      # @param settings [Agama::Storage::Settings::Drive]
      # @return [Planned::Disk]
      def planned_drive(settings)
        return planned_full_drive(settings) unless settings.partitions?

        planned_partitioned_drive(settings)
      end

      # @param settings [Agama::Storage::Settings::Drive]
      # @return [Planned::Disk]
      def planned_full_drive(settings)
        Planned::Disk.new.tap do |planned|
          configure_drive(planned, settings)
          configure_device(planned, settings)
        end
      end

      # @param settings [Agama::Storage::Settings::Drive]
      # @return [Planned::Disk]
      def planned_partitioned_drive(settings)
        Planned::Disk.new.tap do |planned|
          configure_drive(planned, settings)
          configure_partitions(planned, settings)
        end
      end

      # @param planned [Planned::Disk]
      # @param settings [Agama::Storage::Settings::Drive]
      def configure_drive(planned, settings)
        planned.reuse_name = settings.device.name
      end
    end
  end
end
