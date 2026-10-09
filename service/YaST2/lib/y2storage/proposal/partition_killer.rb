# Copyright (c) [2015-2019] SUSE LLC
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

require "yast"
require "storage"

Yast.import "Mode"

module Y2Storage
  module Proposal
    # Utility class to delete partitions from a devicegraph
    class PartitionKiller
      include Yast::Logger

      # Initialize.
      #
      # The optional parameter "disks" can be used to restrict the scope of the
      # collateral actions (see {#delete_by_sid})
      #
      # @param devicegraph [Devicegraph]
      # @param disks [Array<String>] list of kernel-style device names
      def initialize(devicegraph, disks = nil)
        @devicegraph = devicegraph
        @disks = disks
      end

      # Deletes a given partition
      #
      # Optionally, other related partitions that, as a consequence, are not longer useful can be also
      # deleted. For example, when a LVM PV is deleted, the sibling PVs can be deleted too. And the same
      # happens for other devices like the devices used by an MD RAID or a multi-device Btrfs.
      #
      # @param device_sid [Integer] device sid of the partition
      # @param delete_related_partitions [Boolean] whether related partitions should be deleted
      #
      # @return [Array<Integer>] device sids of all the deleted partitions
      def delete_by_sid(device_sid, delete_related_partitions: true)
        partition = find_partition(device_sid)
        return [] unless partition

        if delete_related_partitions
          delete_with_related_partitions(partition)
        else
          delete_partitions([partition])
        end
      end

      protected

      attr_reader :devicegraph, :disks

      def find_partition(sid)
        devicegraph.partitions.detect { |part| part.sid == sid }
      end

      # Deletes a given partition from its corresponding partition table.
      #
      # @note If the partition was the only remaining logical one, it also deletes the
      #   now empty extended partition. The partition table is also deleted when
      #   the last partition is deleted. In case of AutoYaST, deletion of the partition
      #   table is avoided because AutoYaST uses its own logic to reuse partition tables.
      #   In case of a single implicit partition, the partition is not deleted, but only
      #   wiped (leaving the partition empty).
      #
      # @param partition [Partition]
      # @return [Array<Integer>] device sids of all the deleted partitions
      def delete_partition(partition)
        log.info("Deleting partition #{partition.name} in device graph")

        device = partition.partitionable

        if device.implicit_partition_table?
          deleted_partitions = [partition.sid]
          wipe_implicit_partition(partition)
        elsif last_logical?(partition)
          log.info("It's the last logical one, so deleting the extended")
          deleted_partitions = delete_extended(device.partition_table)
        else
          deleted_partitions = [partition.sid]
          partition.partition_table.delete_partition(partition)
        end

        # AutoYaST has its own logic to reuse partition tables.
        return deleted_partitions if Yast::Mode.auto

        device.delete_partition_table if device.partitions.empty?
        deleted_partitions
      end

      # Removes all descendants from the implicit partition
      #
      # @param partition [Y2Storage::Partition] implicit partition
      def wipe_implicit_partition(partition)
        partition.remove_descendants
      end

      # Deletes the extended partition and all the logical ones
      #
      # @param partition_table [PartitionTable]
      # @return [Array<Integer>] device sids of all the deleted partitions
      def delete_extended(partition_table)
        partitions = partition_table.partitions
        extended = partitions.detect { |part| part.type.is?(:extended) }
        logical_parts = partitions.select { |part| part.type.is?(:logical) }

        # This will delete the extended and all the logicals
        sids = [extended.sid] + logical_parts.map(&:sid)
        partition_table.delete_partition(extended)
        sids
      end

      # Checks whether the partition is the only logical one in the
      # partition_table
      #
      # @param partition [Partition]
      # @return [Boolean]
      def last_logical?(partition)
        return false unless partition.type.is?(:logical)

        partitions = partition.partition_table.partitions
        logical_parts = partitions.select { |part| part.type.is?(:logical) }
        logical_parts.size == 1
      end

      # Deletes the given partition and, in addition, all other partitions
      # that belong to the candidate disks and that form some common multidevice
      # storage object (volume group, raid, or multidevice file system).
      #
      # Rationale: when deleting such a partition it makes no sense to leave
      # the other partitions alive. So let's reclaim all the space.
      #
      # @param [Partition] partition that may be part of a multidevice storage object
      # @return [Array<Integer>] device sids of all the deleted partitions
      def delete_with_related_partitions(partition)
        related = related_partitions(partition)
        related.select! { |p| disks.include?(p.partitionable.name) } if disks

        delete_partitions([partition] + related)
      end

      # Partitions that are part of the same multidevice storage object than
      # the given partition
      #
      # @param [Partition] partition that may be part of a multidevice object
      # @return [Array<Partition>] never includes the given partition itself
      def related_partitions(partition)
        devices =
          if lvm_vg?(partition)
            log.info "Deleting #{partition.name}, which is part of an LVM volume group"
            vg = partition.lvm_pv.lvm_vg
            vg.lvm_pvs.map(&:plain_blk_device)
          elsif multidevice_filesystem?(partition)
            log.info "Deleting #{partition.name}, which is part of a multidevice file system"
            partition.filesystem.plain_blk_devices
          elsif raid?(partition)
            log.info "Deleting #{partition.name}, which is part of a raid"
            partition.md.plain_devices
          else
            log.info "Deleting #{partition.name}, which is not related to other partitions"
            []
          end
        devices.delete(partition)
        devices.select { |dev| dev.is?(:partition) }
      end

      # Deletes all partitions in the given list.
      #
      # @param partitions [Array<Partition>] A list of partitions to delete
      # @return [Array<Integer>] device sids of all deleted partitions
      def delete_partitions(partitions)
        target_partitions = partitions.map { |p| find_partition(p.sid) }.compact
        log.info "These partitions will be deleted: #{target_partitions.map(&:name)}"
        target_partitions.map { |p| delete_partition(p) }.flatten
      end

      # Checks whether the partition is part of a volume group
      #
      # @param partition [Partition]
      # @return [Boolean]
      def lvm_vg?(partition)
        !!(partition.lvm_pv && partition.lvm_pv.lvm_vg)
      end

      # Checks whether the partition is part of a raid
      #
      # @param partition [Partition]
      # @return [Boolean]
      def raid?(partition)
        !!partition.md
      end

      # Checks whether the partition is part of a multidevice file system
      #
      # @param partition [Partition]
      # @return [Boolean]
      def multidevice_filesystem?(partition)
        !!(partition.filesystem && partition.filesystem.multidevice?)
      end
    end
  end
end
