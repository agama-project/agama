# Copyright (c) [2017-2019] SUSE LLC
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

require "y2storage/disk"
require "y2storage/planned/lvm_vg"
require "y2storage/planned/lvm_lv"

module Y2Storage
  module Proposal
    # Class to provide free space during the AutoYaST proposal by deleting
    # partitions and partition tables according to the information in the
    # AutoYaST profile.
    class AutoinstSpaceMaker
      include Yast::Logger

      # @return [AutoinstIssues::List] List of detected problems
      attr_reader :issues_list

      # Constructor
      #
      # @param disk_analyzer [DiskAnalyzer] information about existing partitions
      def initialize(disk_analyzer, issues_list = nil)
        @disk_analyzer = disk_analyzer
        @issues_list = issues_list || ::Installation::AutoinstIssues::List.new
      end

      # Performs all the delete operations specified in the AutoYaST profile
      #
      # @param original_devicegraph [Devicegraph] initial devicegraph
      # @param drives_map           [AutoinstDrivesMap] drives map
      # @param planned_devices      [Array<Planned::Partition>] set of partitions
      #   to make space for.
      def cleaned_devicegraph(original_devicegraph, drives_map, planned_devices)
        devicegraph = original_devicegraph.dup

        reused_devices = reused_devices_by_disk(devicegraph, planned_devices)
        sid_map = partitions_sid_map(devicegraph)

        # FIXME: if using the old syntax for RAIDs, with a single <drive> entry that describes several
        # MDs, there is only one entry in the map for the first MD described by the drive section.
        # Other MDs included as <partition> in the same <drive> will not be processed here.
        drives_map.each_pair do |disk_name, drive_spec|
          disk = BlkDevice.find_by_name(devicegraph, disk_name)
          next unless disk

          delete_stuff(devicegraph, disk, drive_spec, reused_devices[disk.name])
        end

        adjust_reuse_values(devicegraph, planned_devices, sid_map)
        devicegraph
      end

      protected

      attr_reader :disk_analyzer

      # Deletes unwanted partitions for the given disk
      #
      # @param devicegraph    [Devicegraph]
      # @param disk           [BlkDevice] the device referenced by the drive section, it's usually
      #   a disk but it can also be an MD RAID, a bcache...
      # @param drive_spec     [AutoinstProfile::DriveSection]
      # @param reused_devices [Array<String>,nil] names of reused devices (disks, raids, partitions...)
      def delete_stuff(devicegraph, disk, drive_spec, reused_devices)
        reused_devices ||= []
        if drive_spec.initialize_attr && reused_devices.empty?
          disk.remove_descendants
          return
        end

        if partition_table?(disk)
          delete_by_use(devicegraph, disk, drive_spec, reused_devices)
        else
          clean_up_disk_by_use(disk, drive_spec, reused_devices)
        end
      end

      # Deletes unwanted partition according to the "use" element
      #
      # @param devicegraph    [Devicegraph]
      # @param disk           [Disk]
      # @param drive_spec     [AutoinstProfile::DriveSection]
      # @param reused_devices [Array<String>] Reused disks and partitions names
      def delete_by_use(devicegraph, disk, drive_spec, reused_devices)
        return if drive_spec.use == "free" || !partition_table?(disk)

        case drive_spec.use
        when "all"
          delete_partitions(devicegraph, disk.partitions, reused_devices)
        when "linux"
          delete_linux_partitions(devicegraph, disk, reused_devices)
        when Array
          delete_partitions_by_number(devicegraph, disk, drive_spec.use, reused_devices)
        else
          register_invalid_use_value(drive_spec)
        end
      end

      # Cleans up the disk (or RAID, or bcache...) according to the "use" element
      #
      # This premature cleanup was introduced because of bsc#1115749. It is not strictly needed for the
      # proposal to work, but it helps to prevent LVM name collisions during the phase in which the VGs
      # are being planned. Taking into account how (and when) those names are assigned, if there is a
      # pre-existing volume group we don't plan to keep, the sooner we delete it the better.
      #
      # @param disk           [Disk] see {#delete_stuff}
      # @param drive_spec     [AutoinstProfile::DriveSection]
      # @param reused_devices [Array<String>] Reused disks and partitions names
      def clean_up_disk_by_use(disk, drive_spec, reused_devices)
        return if drive_spec.use != "all" || reused_devices.include?(disk.name)

        disk.remove_descendants
      end

      # Search a partition by its sid
      #
      # @param devicegraph  [Devicegraph] Working devicegraph
      def partition_by_sid(devicegraph, sid)
        devicegraph.partitions.find { |p| p.sid == sid }
      end

      # Deletes Linux partitions from a disk in the given devicegraph
      #
      # @param devicegraph    [Devicegraph] Working devicegraph
      # @param disk           [Disk]        Disk to remove partitions from
      # @param reused_devices [Array<String>] Reused disks and partitions names
      def delete_linux_partitions(devicegraph, disk, reused_devices)
        parts = disk_analyzer.linux_partitions(disk)
        delete_partitions(devicegraph, parts, reused_devices)
      end

      # Deletes Linux partitions which number is included in a list
      #
      # @param devicegraph [Devicegraph]    Working devicegraph
      # @param disk        [Disk]           Disk to remove partitions from
      # @param partition_nrs [Array<Integer>] List of partition numbers
      def delete_partitions_by_number(devicegraph, disk, partition_nrs, reused_devices)
        parts = disk.partitions.select { |n| partition_nrs.include?(n.number) }
        delete_partitions(devicegraph, parts, reused_devices)
      end

      # Deletes the indicated partitions
      #
      # The {Proposal::PartitionKiller} tries to remove as many partitions as possible by default. For
      # example, when a LVM PV is deleted, the rest of PVs are deleted too. But this is not the desired
      # behaviour for AutoYaST. With AutoYaST, only the indicated partitions should be removed.
      #
      # @param devicegraph     [Devicegraph]               devicegraph
      # @param parts           [Array<Planned::Partition>] parts to delete
      # @param reused_devices  [Array<String>]             reused disks and partitions names
      def delete_partitions(devicegraph, parts, reused_devices)
        partition_killer = Proposal::PartitionKiller.new(devicegraph)
        parts_to_delete = parts.reject { |p| reused_devices.include?(p.name) }
        parts_to_delete.map(&:sid).each do |sid|
          partition = partition_by_sid(devicegraph, sid)
          next unless partition

          # Removes only this partition and nothing else.
          partition_killer.delete_by_sid(partition.sid, delete_related_partitions: false)
        end
      end

      # Register an invalid/missing value for 'use'
      #
      # @param drive_spec  [AutoinstProfile::DriveSection]
      def register_invalid_use_value(drive_spec)
        if drive_spec.use
          issues_list.add(Y2Storage::AutoinstIssues::InvalidValue, drive_spec, :use)
        else
          issues_list.add(Y2Storage::AutoinstIssues::MissingValue, drive_spec, :use)
        end
      end

      # Return a map of reused devices
      #
      # Calculates which partitions, disks, MDs, etc. are meant to be reused and, as a consequence,
      # should not be deleted or wiped.
      #
      # @param devicegraph     [Devicegraph]               devicegraph
      # @param planned_devices [Array<Planned::Device>] set of devices
      # @return [Hash<String,Array<String>>] keys are names of a device typically represented by a drive
      #   section (a disk, a RAID, etc.), values are lists of the corresponding reused devices which may
      #   include the device itself or any of its partitions
      def reused_devices_by_disk(devicegraph, planned_devices)
        find_reused_devices(devicegraph, planned_devices).each_with_object({}) do |part, map|
          disk_name = part.is?(:partition) ? part.partitionable.name : part.name
          map[disk_name] ||= []
          map[disk_name] << part.name
        end
      end

      # Determine which disks and partitions will be reused
      #
      # @param devicegraph     [Devicegraph]               devicegraph
      # @param planned_devices [Array<Planned::Partition>] set of partitions
      # @return [Hash<String,Array<String>>] disk name to list of reused partitions map
      def find_reused_devices(devicegraph, planned_devices)
        reused_devices = planned_devices.select(&:reuse_name).each_with_object([]) do |planned, all|
          real_devices = real_reused_devices_for(devicegraph, planned)
          all.concat(real_devices) if real_devices
        end

        ancestors = reused_devices.map(&:ancestors).flatten
        (reused_devices + ancestors).select { |dev| reusable?(dev) }
      end

      # Whether this kind of device needs to be included in the list of reused devices
      #
      # @see #find_reused_devices
      #
      # @param device [Device]
      # @return [Boolean]
      def reusable?(device)
        return true if device.is?(:partition)

        # Block devices typically described by a <drive> section
        device.is?(:disk_device, :software_raid, :bcache)
      end

      # Real devices from the devicegraph that will be reused for the given planned device
      #
      # @param devicegraph    [Devicegraph]     devicegraph
      # @param planned_device [Planned::Device] planned_device
      def real_reused_devices_for(devicegraph, planned_device)
        case planned_device
        when Y2Storage::Planned::Partition
          [devicegraph.partitions.find { |p| planned_device.reuse_name == p.name }]
        when Y2Storage::Planned::LvmVg
          vg = devicegraph.lvm_vgs.find { |v| File.join("/dev", planned_device.reuse_name) == v.name }
          [vg] + vg.lvm_pvs
        when Y2Storage::Planned::Md
          [devicegraph.md_raids.find { |r| planned_device.reuse_name == r.name }]
        when Y2Storage::Planned::Bcache
          [devicegraph.bcaches.find { |b| planned_device.reuse_name == b.name }]
        end
      end

      # Build a device name to sid map
      #
      # @param devicegraph [Devicegraph] devicegraph
      # @return [Hash<String,Integer>] Map with device names as keys and sid as values.
      #
      # @see adjust_reuse_values
      def partitions_sid_map(devicegraph)
        devicegraph.partitions.each_with_object({}) { |p, m| m[p.name] = p.sid }
      end

      # Adjust reuse values
      #
      # When using logical partitions (ms-dos), removing a partition might cause the rest of
      # logical partitions numbers to shift. In such a situation, 'reuse_name' properties of planned
      # devices will break (they might point to a non-existent device).
      #
      # This method takes care of setting the correct value for every 'reuse_name' property (thus
      # planned_devices are modified).
      #
      # @param devicegraph     [Devicegraph]               devicegraph
      # @param planned_devices [Array<Planned::Partition>] set of partitions to make space for
      # @param sid_map         [Hash<String,Integer>]      device name to sid map
      #
      # @see sid_map
      # rubocop:disable Style/MultilineBlockChain
      def adjust_reuse_values(devicegraph, planned_devices, sid_map)
        planned_devices.select do |d|
          d.is_a?(Y2Storage::Planned::Partition) && d.reuse_name
        end.each do |device|
          sid = sid_map[device.reuse_name]
          partition = partition_by_sid(devicegraph, sid)
          device.reuse_name = partition.name
        end
      end
      # rubocop:enable all

      # Determines whether a device has a partition table
      #
      # @param device [Device] Device
      # @return [Boolean] true if the device has a partition table; false otherwise
      def partition_table?(device)
        device.respond_to?(:partition_table) && !!device.partition_table
      end
    end
  end
end
