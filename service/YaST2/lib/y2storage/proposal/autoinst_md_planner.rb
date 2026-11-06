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

require "y2storage/proposal/autoinst_drive_planner"

module Y2Storage
  module Proposal
    # This class converts an AutoYaST specification into a Planned::Md in order
    # to set up a MD RAID.
    class AutoinstMdPlanner < AutoinstDrivePlanner
      # Returns a MD array according to an AutoYaST specification
      #
      # @param drive [AutoinstProfile::DriveSection] drive section describing the MD RAID
      # @return [Array<Planned::Md>] Planned MD RAID devices
      def planned_devices(drive)
        mds =
          if drive.device == "/dev/md"
            non_partitioned_md_old_style(drive)
          elsif drive.unwanted_partitions?
            non_partitioned_md(drive)
          else
            partitioned_md(drive)
          end

        Array(mds)
      end

      private

      # Returns a list of non partitioned MD RAID devices from old-style AutoYaST profile
      #
      # Using `/dev/md` as device name means that the whole drive section should be treated as an
      # old-style AutoYaST MD RAID description.
      #
      #   * Each partition represents an MD RAID and the `partition_nr` is used to indicate
      #     the kernel name: `/dev/md0`, `/dev/md1`, etc.
      #   * Partitioned MD RAID devices are not supported
      #
      # @param drive [AutoinstProfile::DriveSection] drive section describing the list of MD RAID
      #   devices (old-style AutoYaST)
      # @return [Array<Planned::Md>] List of planned MD RAID devices
      def non_partitioned_md_old_style(drive)
        drive.partitions.each_with_object([]) do |part_section, mds|
          md = md_from_partition_section(drive, part_section)
          mds << md if md
        end
      end

      # Returns a non partitioned MD RAID
      #
      # @param drive [AutoinstProfile::DriveSection] drive section describing the MD RAID
      # @return [Planned::Md] Planned MD RAID device
      def non_partitioned_md(drive)
        md = Planned::Md.new(name: drive.name_for_md)
        part_section = drive.partitions.first
        device_config(md, part_section, drive)
        add_md_reuse(md, part_section) if part_section.create == false
        add_raid_options(md, drive.raid_options || part_section.raid_options)
        md
      end

      # Returns a partitioned MD RAID
      #
      # @param drive [AutoinstProfile::DriveSection] drive section describing the MD RAID
      # @return [Planned::Md] Planned MD RAID device
      def partitioned_md(drive)
        md = Planned::Md.new(name: drive.device)
        md.ptable_type = Y2Storage::PartitionTables::Type.find(drive.disklabel) if drive.disklabel
        add_raid_options(md, drive.raid_options)
        md.partitions = drive.partitions.map do |part_section|
          plan_partition(md, drive, part_section)
        end
        add_md_reuse(md, drive) if md.partitions.any?(&:reuse?)
        md
      end

      # Returns a non partitioned MD RAID from an AutoYaST partition section
      #
      # @param drive        [AutoinstProfile::DriveSection] drive section describing the list of MD
      #   RAID devices (old-style AutoYaST)
      # @param part_section [AutoinstProfile::PartitionSection] partition section describing the
      #   MD RAID
      # @return [Planned::Md, nil] the planned MD RAID device; nil if could not be created
      def md_from_partition_section(drive, part_section)
        return nil unless valid_part_section?(part_section)

        md = Planned::Md.new(name: part_section.name_for_md)
        device_config(md, part_section, drive)
        add_md_reuse(md, part_section) if part_section.create == false
        add_raid_options(md, part_section.raid_options)
        md
      end

      # Determines whether given partition section is valid and registers issues if not
      #
      # @param part_section [AutoinstProfile::PartitionSection]
      # @return [Boolean] true when the partition section is valid; false otherwise
      def valid_part_section?(part_section)
        return true if part_section.partition_nr

        issues_list.add(Y2Storage::AutoinstIssues::MissingValue, part_section, :partition_nr)

        false
      end

      # Adds RAID options to a planned RAID
      #
      # @param md [Planned::Md] Planned RAID
      # @param raid_options [AutoinstProfile::RaidOptionsSection] raid options section from
      #   the profile
      def add_raid_options(md, raid_options)
        md.md_level = raid_level_from(raid_options)
        return if raid_options.nil?

        md.name = raid_options.raid_name if raid_options.raid_name
        md.chunk_size = chunk_size_from_string(raid_options.chunk_size) if raid_options.chunk_size
        md.md_parity = raid_options.md_parity if raid_options.parity_algorithm
        md.devices_order = raid_options.device_order if !raid_options.device_order.empty?
      end

      # Sets 'reusing' attributes for a MD RAID
      #
      # @param md      [Planned::Md] Planned MD RAID
      # @param section [AutoinstProfile::PartitionSection,AutoinstProfile::Drive] AutoYaST specification
      def add_md_reuse(md, section)
        md_to_reuse = find_md_to_reuse(md)
        if md_to_reuse.nil?
          issues_list.add(Y2Storage::AutoinstIssues::MissingReusableDevice, section)
          return
        end
        md.reuse_name = md_to_reuse.name
        config_filesystem_reuse(md, md_to_reuse, section)
      end

      # Parses the user specified chunk size
      #
      # @param string [String] User specified chunk size
      # @return [DiskSize]
      def chunk_size_from_string(string)
        (string =~ /\D/) ? DiskSize.parse(string) : DiskSize.KB(string.to_i)
      end

      # Given a user specified RAID type, it returns the RAID level
      #
      # @note If the raid_type is not specified or is invalid, falls back to RAID1.
      #
      # @param raid_options [AutoinstProfile::RaidOptionsSection,nil] User defined RAID options
      # @return [Y2Storage::MdLevel] RAID level
      def raid_level_from(raid_options)
        return Y2Storage::MdLevel::RAID1 if raid_options.nil? || raid_options.raid_type.nil?

        MdLevel.find(raid_options.raid_type)
      rescue NameError
        issues_list.add(Y2Storage::AutoinstIssues::InvalidValue,
          raid_options.raid_type, :raid_type, "raid1")
        Y2Storage::MdLevel::RAID1
      end

      # MD device to be reused by the given planned MD
      #
      # @param md      [Planned::Md] Planned MD RAID
      def find_md_to_reuse(md)
        dev_by_name = devicegraph.find_by_any_name(md.name, alternative_names: true)

        return dev_by_name if dev_by_name&.is?(:md)

        nil
      end
    end
  end
end
