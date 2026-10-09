# Copyright (c) [2018] SUSE LLC
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
    # This class is responsible for creating (or updating) a partition table in a given device.
    #
    # It takes the partition table type for a planned device and:
    #
    # * If no partition table exists, it creates a new one.
    # * If the partition table already contains any partition, do nothing.
    # * If a partition table of the same type already exists, just do nothing.
    # * If no partition table type is specified (there is no planned partition table type),
    #   then use the preferred type for the device.
    class PartitionTableCreator
      # Creates or updates the partition table
      #
      # It does nothing if current partition table type and wanted one are the same.
      # The device object might be modified.
      #
      # @param device              [Y2Storage::Device] Device to set the partition table on
      # @param planned_ptable_type [Y2Storage::PartitionTables::Type] User preferred partition table type
      def create_or_update(device, planned_ptable_type)
        return if !device.partitions.empty? || same_ptable_type?(device, planned_ptable_type)

        ptable_type = suitable_ptable_type(device, planned_ptable_type)
        device.remove_descendants if device.partition_table
        device.create_partition_table(ptable_type)
      end

      private

      # Determines which partition table type should be used
      #
      # @param device              [Y2Storage::Disk] Disk to set the partition table on
      # @param planned_ptable_type [Y2Storage::PartitionTables::Type,nil] Wanted partition table type
      # @return [Y2Storage::PartitionTables::Type] Partition table type
      def suitable_ptable_type(device, planned_ptable_type)
        device_ptable_type = device.partition_table ? device.partition_table.type : nil
        planned_ptable_type || device_ptable_type || device.preferred_ptable_type
      end

      # Determines whether the device already contains a partition table of the given type
      #
      # @param device      [Y2Storage::Disk] Disk to set the partition table on
      # @param ptable_type [Y2Storage::PartitionTables::Type,nil] Partition table type
      # @return [Boolean]
      def same_ptable_type?(device, ptable_type)
        device.partition_table && device.partition_table.type == ptable_type
      end
    end
  end
end
