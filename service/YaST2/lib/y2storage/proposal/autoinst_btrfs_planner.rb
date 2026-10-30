# Copyright (c) [2019] SUSE LLC
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
require "y2storage/planned/btrfs"
require "y2storage/btrfs_raid_level"

module Y2Storage
  module Proposal
    # This class converts an AutoYaST specification into a Planned::Btrfs in order to set up a
    # multi-device Btrfs.
    class AutoinstBtrfsPlanner < AutoinstDrivePlanner
      # Returns a planned Btrfs according to an AutoYaST specification
      #
      # @param drive_section [AutoinstProfile::DriveSection] drive section describing the Btrfs
      # @return [Array<Planned::Btrfs>] Array containing the planned Btrfs
      def planned_devices(drive_section)
        [planned_btrfs(drive_section)]
      end

      private

      # Generates a planned Btrfs from a drive section
      #
      # @return [Planned::Btrfs]
      def planned_btrfs(drive_section)
        add_issues(drive_section)

        partition_section = drive_section.partitions.first

        filesystem = Planned::Btrfs.new(drive_section.device)
        configure_btrfs(filesystem, partition_section, drive_section)

        reuse_btrfs(filesystem, partition_section) if reuse_btrfs?(partition_section)

        filesystem
      end

      # Configure a planned Btrfs filesystem according to a drive section
      #
      # @see AutoinstDrivePlanner#configure_filesystem
      #
      # @param filesystem [Planned::Btrfs]
      # @param partition_section [AutoinstProfile::PartitionSection]
      # @param drive_section [AutoinstProfile::DriveSection]
      def configure_btrfs(filesystem, partition_section, drive_section)
        configure_filesystem(filesystem, partition_section, drive_section)

        add_btrfs_attrs(filesystem, drive_section)
      end

      # Sets specific Btrfs attributes according to the values in the drive section
      #
      # @param filesystem [Planned::Btrfs]
      # @param drive_section [AutoinstProfile::DriveSection]
      def add_btrfs_attrs(filesystem, drive_section)
        filesystem.data_raid_level = raid_level(drive_section, :data_raid_level)
        filesystem.metadata_raid_level = raid_level(drive_section, :metadata_raid_level)
      end

      # RAID level for the data or metadata, according to the drive section
      #
      # A default value is returned if the drive section does not specify the value.
      #
      # @param drive_section [AutoinstProfile::DriveSection]
      # @param attr [Symbol] (i.e., :data_raid_level or :metadata_raid_level
      def raid_level(drive_section, attr)
        btrfs_options = drive_section.btrfs_options
        return default_raid_level unless btrfs_options

        level = btrfs_options.send(attr)
        return default_raid_level unless level

        Y2Storage::BtrfsRaidLevel.find(level) || default_raid_level
      end

      # Default RAID level when the drive section does not specify a value
      #
      # @return [Y2Storage::BtrfsRaidLevel]
      def default_raid_level
        Y2Storage::BtrfsRaidLevel::DEFAULT
      end

      # Adds issues when something is wrong in the drive section
      #
      # The drive section should only contain one partition.
      #
      # @param drive_section [AutoinstProfile::DriveSection]
      def add_issues(drive_section)
        if drive_section.wanted_partitions?
          issues_list.add(Y2Storage::AutoinstIssues::NoPartitionable,
            drive_section)
        end
        if drive_section.partitions.size > 1
          issues_list.add(Y2Storage::AutoinstIssues::SurplusPartitions,
            drive_section)
        end
        nil
      end

      # Whether an existing filesystem has to be reused (no new one will be created)
      #
      # @param partition_section [AutoinstProfile::PartitionSection]
      # @return [Boolean]
      def reuse_btrfs?(partition_section)
        # create attribute needs to be set to false explicitly
        partition_section.create == false
      end

      # Sets 'reusing' attributes when a multi-device Btrfs is going to be reused
      #
      # @see reuse_btrfs?
      #
      # @param filesystem [Planned::Btrfs]
      # @param partition_section [AutoinstProfile::PartitionSection]
      def reuse_btrfs(filesystem, partition_section)
        reused_btrfs = reused_btrfs(partition_section)

        if !reused_btrfs
          issues_list.add(Y2Storage::AutoinstIssues::MissingReusableDevice, partition_section)
          return
        end

        filesystem.uuid = reused_btrfs.uuid
        filesystem.reuse_sid = reused_btrfs.sid
      end

      # Existing filesystem to be reused
      #
      # @note The filesystem UUID must be given in the AutoYaST profile (partition section).
      #
      # @param partition_section [AutoinstProfile::PartitionSection]
      #
      # @return [Filesystems::Btrfs, nil] nil if no filesystem found
      def reused_btrfs(partition_section)
        return nil unless partition_section.uuid

        devicegraph.btrfs_filesystems.detect { |f| f.uuid == partition_section.uuid }
      end
    end
  end
end
