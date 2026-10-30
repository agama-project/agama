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
require "y2storage/planned/bcache"

Yast.import "Arch"

module Y2Storage
  module Proposal
    # This class converts an AutoYaST specification into a Planned::Bcache in order
    # to set up bcache.
    class AutoinstBcachePlanner < AutoinstDrivePlanner
      # Returns a planned bcache device.
      #
      # This method registers an issue when not running on a x86_64 architecture.
      #
      # @param drive [AutoinstProfile::DriveSection] drive section describing the bcache set up
      # @return [Array<Planned::Bcache>] Planned bcache device
      def planned_devices(drive)
        unless Yast::Arch.x86_64
          issues_list.add(Y2Storage::AutoinstIssues::UnsupportedDriveSection,
            drive)
        end
        bcaches =
          if drive.unwanted_partitions?
            non_partitioned_bcache(drive)
          else
            partition_bcache(drive)
          end
        Array(bcaches)
      end

      private

      # Returns a non partitioned bcache device
      #
      # @param drive [AutoinstProfile::DriveSection] drive section describing the bcache set up
      # @return [Planned::Bcache] Planned bcache device
      def non_partitioned_bcache(drive)
        bcache = Y2Storage::Planned::Bcache.new(name: drive.device)
        part_section = drive.partitions.first
        device_config(bcache, part_section, drive)
        add_bcache_reuse(bcache, part_section) if part_section.create == false
        add_bcache_options(bcache, drive.bcache_options)
        bcache
      end

      # Returns a partitioned bcache device
      #
      # @param drive [AutoinstProfile::DriveSection] drive section describing the bcache set up
      # @return [Planned::Bcache] Planned bcache device
      def partition_bcache(drive)
        bcache = Y2Storage::Planned::Bcache.new(name: drive.device)
        bcache.ptable_type = Y2Storage::PartitionTables::Type.find(drive.disklabel) if drive.disklabel
        bcache.partitions = drive.partitions.map do |part_section|
          plan_partition(bcache, drive, part_section)
        end
        add_bcache_reuse(bcache, drive) if bcache.partitions.any?(&:reuse?)
        add_bcache_options(bcache, drive.bcache_options)
        bcache
      end

      # Adds bcache options
      #
      # @param bcache         [Planned::Bcache] Planned bcache device
      # @param bcache_options [AutoinstProfile::BcacheOptionsSection,nil] User defined bcache
      #   options
      def add_bcache_options(bcache, bcache_options)
        bcache.cache_mode = cache_mode_from(bcache_options)
      end

      # Sets 'reusing' attributes for a bcache
      #
      # @param bcache  [Planned::Bcache] Planned bcache
      # @param section [AutoinstProfile::PartitionSection,AutoinstProfile::Drive] AutoYaST
      #   specification
      def add_bcache_reuse(bcache, section)
        bcache_to_reuse = find_bcache_to_reuse(bcache)
        if bcache_to_reuse.nil?
          issues_list.add(Y2Storage::AutoinstIssues::MissingReusableDevice, section)
          return
        end
        bcache.reuse_name = bcache_to_reuse.name
        config_filesystem_reuse(bcache, bcache_to_reuse, section)
      end

      # Finds the bcache to be reused by the given planned bcache
      #
      # @param bcache [Planned::Bcache] Planned bcache
      def find_bcache_to_reuse(bcache)
        dev_by_name = devicegraph.find_by_any_name(bcache.name, alternative_names: true)

        return dev_by_name if dev_by_name&.is?(:bcache)

        nil
      end

      # Given a user specified bcache options, it returns the cache mode
      #
      # @param bcache_options [AutoinstProfile::BcacheOptionsSection,nil] User defined bcache
      #   options; `nil` if cache_mode is missing or invalid
      # @return [Y2Storage::CacheMode,nil] bcache cache mode; nil if no cache mode was specified
      def cache_mode_from(bcache_options)
        return nil if bcache_options.nil? || bcache_options.cache_mode.nil?

        Y2Storage::CacheMode.find(bcache_options.cache_mode)
      rescue NameError
        issues_list.add(Y2Storage::AutoinstIssues::InvalidValue, bcache_options, :cache_mode, :skip)
        nil
      end
    end
  end
end
