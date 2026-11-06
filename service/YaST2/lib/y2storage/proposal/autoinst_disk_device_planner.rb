# Copyright (c) [2018-2019] SUSE LLC
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

require "y2storage/proposal/autoinst_drive_planner"

module Y2Storage
  module Proposal
    # This class converts an AutoYaST specification into a set of planned block devices
    # ({Y2Storage::Planned::Partition} and {Y2Storage::Planned::StrayBlkDevice}).
    class AutoinstDiskDevicePlanner < AutoinstDrivePlanner
      # Returns an array of planned partitions for a given disk or the disk
      # itself if there are no partitions planned
      #
      # It supports three different kind of specifications:
      #
      # * Old Xen partitioning, which relies in a non-existent device to group similar ones
      #   (for instance, `/dev/xvda` to group `/dev/xvda1`, `/dev/xvda2`, etc.).
      # * New Xen partitioning, which uses stray block devices.
      # * Regular disks.
      #
      # @param drive [AutoinstProfile::DriveSection] drive section describing
      #   the layout for the disk
      # @return [Array<Planned::Partition, Planned::StrayBlkDevice>] List of planned partitions or disks
      def planned_devices(drive)
        disk = BlkDevice.find_by_name(devicegraph, drive.device)
        if disk.nil?
          planned_for_stray_devices(drive)
        elsif disk.is?(:stray_blk_device)
          planned_for_stray_device(disk, drive)
        else
          planned_for_disk(disk, drive)
        end
      end

      private

      # Returns an array of planned partitions for a given disk or the disk
      # itself if there are no partitions planned
      #
      # @note When using a whole disk, the partition marked as '0' (or the first one of no
      #   partition is explicitly set) contains the configuration values for the whole disk.
      #
      # @param disk [Disk,Dasd] Disk to place the partitions on
      # @param drive [AutoinstProfile::DriveSection] drive section describing
      #   the layout for the disk
      # @return [Array<Planned::Disk, Planned::StrayBlkDevice>] List of planned partitions or disks
      #
      # @see AutoinstProfile::DriveSection#master_partition
      def planned_for_disk(disk, drive)
        master_partition = drive.master_partition
        result = if master_partition
          planned_for_full_disk(disk, drive, master_partition)
        else
          planned_for_partitions(disk, drive)
        end

        Array(result)
      end

      # Returns disk to be used without partitions.
      #
      # @note This is not quite what #planned_for_stray_devices is for:
      #   #planned_for_full_disk creates a single entry for the full disk while
      #   #planned_for_stray_devices creates full disk entries for each
      #   partition.
      #
      # @param drive [AutoinstProfile::DriveSection] drive section describing
      #   the layout for the disk
      # @param part [AutoinstProfile::PartitionSection] partition section with
      #   elements to apply to the full disk
      # @return [Array<Planned::Disk>] List containing planned disk
      #
      # @note The part argument is used when we emulate the sle12 behavior to
      #   have partition 0 mean the full disk.
      def planned_for_full_disk(disk, drive, part)
        issues_list.add(Y2Storage::AutoinstIssues::SurplusPartitions, drive) if drive.partitions.size > 1
        planned_disk = Y2Storage::Planned::Disk.new
        device_config(planned_disk, part, drive)
        add_device_reuse(planned_disk, disk, part)

        [planned_disk]
      end

      # Returns an array of planned partitions for a given disk
      #
      # @param disk [Disk,Dasd] Disk to place the partitions on
      # @param drive [AutoinstProfile::DriveSection] drive section describing
      #   the layout for the disk
      # @return [Planned::Disk] List of planned partitions
      def planned_for_partitions(disk, drive)
        planned_disk = Y2Storage::Planned::Disk.new

        planned_disk.partitions = drive.partitions.each_with_object([]).each do |section, memo|
          planned_partition = plan_partition(disk, drive, section)
          memo << planned_partition if planned_partition
        end

        planned_disk
      end

      # Returns an array of planned stray block devices
      #
      # @param stray_blk_device [StrayBlkDevice] Stray block device to work on
      # @param drive [AutoinstProfile::DriveSection] drive section describing
      #   the stray block device
      # @return [Planned::Disk] List of planned block devices
      def planned_for_stray_device(stray_blk_device, drive)
        issues_list.add(Y2Storage::AutoinstIssues::NoPartitionable, drive) if drive.wanted_partitions?
        issues_list.add(Y2Storage::AutoinstIssues::SurplusPartitions, drive) if drive.partitions.size > 1
        master_partition = drive.partitions.first
        planned_stray_device = Y2Storage::Planned::StrayBlkDevice.new
        device_config(planned_stray_device, master_partition, drive)
        add_device_reuse(planned_stray_device, stray_blk_device, master_partition)
        [planned_stray_device]
      end

      # Returns an array of planned Xen partitions according to a <drive>
      # section which groups virtual partitions with a similar name (e.g. a
      # "/dev/xvda" section describing "/dev/xvda1" and "/dev/xvda2").
      #
      # @param drive [AutoinstProfile::DriveSection] drive section describing
      #   a set of stray block devices (Xen virtual partitions)
      # @return [Array<Planned::StrayBlkDevice>] List of planned devices
      def planned_for_stray_devices(drive)
        result = []
        drive.partitions.each do |section|
          # Since this drive section was included in the drives map, we can be
          # sure that all partitions include a valid partition_nr
          # (see {AutoinstDrivesMap#stray_devices_group?}).
          name = drive.device + section.partition_nr.to_s
          stray = Y2Storage::Planned::StrayBlkDevice.new
          device_config(stray, section, drive)

          # Just for symmetry respect partitions, try to infer the filesystem
          # type if it's omitted in the profile for devices that are going to be
          # re-formatted but not mounted, so there is no reasonable way to infer
          # the appropiate filesystem type based on the mount path (bsc#1060637).
          if stray.filesystem_type.nil?
            device_to_use = devicegraph.stray_blk_devices.find { |d| d.name == name }
            stray.filesystem_type = device_to_use.filesystem_type if device_to_use
          end

          device = devicegraph.find_by_name(name)
          add_device_reuse(stray, device, section)

          result << stray
        end

        result
      end
    end
  end
end
