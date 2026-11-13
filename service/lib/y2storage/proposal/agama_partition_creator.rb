# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require "y2storage/proposal/partition_creator"
require "y2storage/proposal/discoverable_partition_id"

module Y2Storage
  module Proposal
    # Partition creator used by the Agama proposal
    #
    # In addition to what `PartitionCreator` does, the partitions without an explicit id get the id
    # defined by the Discoverable Partitions Specification for their mount point, if any (see
    # {DiscoverablePartitionId}).
    class AgamaPartitionCreator < PartitionCreator
    private

      # Partition id for a new partition
      #
      # The id explicitly planned for the partition is always used. Otherwise, the id defined by the
      # Discoverable Partitions Specification is used if the partition table supports it, falling
      # back to swap or linux.
      #
      # @see PartitionCreator#partition_id
      #
      # @param planned_partition [Planned::Partition]
      # @param ptable [PartitionTables::Base] partition table in which the partition is created
      #
      # @return [PartitionId]
      def partition_id(planned_partition, ptable)
        planned_partition.partition_id ||
          discoverable_partition_id(planned_partition, ptable) ||
          default_partition_id(planned_partition)
      end

      # Partition id defined by the Discoverable Partitions Specification, if any
      #
      # Partitions used as component of another device (e.g., LVM physical volume or MD member)
      # are not considered.
      #
      # @param planned_partition [Planned::Partition]
      # @param ptable [PartitionTables::Base]
      #
      # @return [PartitionId, nil]
      def discoverable_partition_id(planned_partition, ptable)
        return if planned_partition.component?

        DiscoverablePartitionId.new.for(planned_partition.mount_point, ptable)
      end
    end
  end
end
