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
      def planned_devices(drive)
        result =
          if drive.partitions?
            planned_for_partitioned_drive(drive)
          else
            planned_for_full_drive(drive)
          end
        Array(result)
      end

      private

      def planned_for_partitioned_drive(drive)
        # TODO: register error if this contain some kind of specification for full disk like
        # "format", "mounts", etc.

        planned_disk = Y2Storage::Planned::Disk.new

        planned_disk.partitions = drive.partitions.each_with_object([]).each do |partition, memo|
          planned_partition = plan_partition(disk, drive, section)
          memo << planned_partition if planned_partition
        end

        planned_disk
      end
    end
  end
end
