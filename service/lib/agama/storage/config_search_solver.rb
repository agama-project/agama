# frozen_string_literal: true

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

module Agama
  module Storage
    # Solver for the search configs.
    class ConfigSearchSolver
      # @param devicegraph [Devicegraph] used to find the corresponding devices that will get
      #   associated to each search element.
      def initialize(devicegraph)
        @devicegraph = devicegraph
      end

      # Solves all the search configs within a given config.
      #
      # @note The config object is modified.
      #
      # @param config [Agama::Storage::Config]
      def solve(config)
        @sids = []
        config.drives = config.drives.flat_map { |d| solve_drive(d) }
      end

    private

      # @return [Devicegraph]
      attr_reader :devicegraph

      # @return [Array<Integer>] SIDs of the devices that are already associated to another search.
      attr_reader :sids

      # @see #solve
      #
      # @note The given drive object can be modified
      #
      # @param original_drive [Configs::Drive]
      # @return [Configs::Drive, Array<Configs::Drive>]
      def solve_drive(original_drive)
        devices = find_drives(original_drive.search)
        return without_device(original_drive) if devices.empty?

        devices.map do |device|
          drive_copy(original_drive, device)
        end
      end

      # Marks the search of the given config object as solved
      #
      # @note The config object is modified.
      #
      # @param config [Configs::Drive, Configs::Partition]
      # @return [Configs::Drive, Configs::Partition]
      def without_device(config)
        config.search.solve
        config
      end

      # see #solve_drive
      def drive_copy(original_drive, device)
        drive_config = original_drive.copy
        drive_config.search.solve(device)
        add_found(drive_config)

        return drive_config unless drive_config.partitions?

        drive_config.partitions = drive_config.partitions.flat_map do |partition_config|
          solve_partition(partition_config, device)
        end

        drive_config
      end

      # see #solve_drive
      #
      # @note The given partition object can be modified
      #
      # @param original_partition [Configs::Partition]
      # @param drive_device [Y2Storage::Partitionable]
      # @return [Configs::Partition, Array<Configs::Partition>]
      def solve_partition(original_partition, drive_device)
        return original_partition unless original_partition.search

        partitions = find_partitions(original_partition.search, drive_device)
        return without_device(original_partition) if partitions.empty?

        partitions.map do |partition|
          partition_config = original_partition.copy
          partition_config.search.solve(partition)
          add_found(partition_config)

          partition_config
        end
      end

      # Finds the drives matching the given search config.
      #
      # @param search_config [Agama::Storage::Configs::Search]
      # @return [Y2Storage::Device, nil]
      def find_drives(search_config)
        candidates = candidate_devices(search_config, default: devicegraph.blk_devices)
        candidates.select! { |d| d.is?(:disk_device, :stray_blk_device) }
        next_unassigned_devices(candidates, search_config)
      end

      # Finds the partitions matching the given search config, if any
      #
      # @param search_config [Agama::Storage::Configs::Search]
      # @return [Y2Storage::Device, nil]
      def find_partitions(search_config, device)
        candidates = candidate_devices(search_config, default: device.partitions)
        candidates.select! { |d| d.is?(:partition) }
        next_unassigned_devices(candidates, search_config)
      end

      # Candidate devices for the given search config.
      #
      # @param search_config [Agama::Storage::Configs::Search]
      # @param default [Array<Y2Storage::Device>] Candidates if the search does not indicate
      #   conditions.
      # @return [Array<Y2Storage::Device>]
      def candidate_devices(search_config, default: [])
        return default if search_config.always_match?

        [find_device(search_config)].compact
      end

      # Performs a search in the devicegraph to find a device matching the given search config.
      #
      # @param search_config [Agama::Storage::Configs::Search]
      # @return [Y2Storage::Device]
      def find_device(search_config)
        devicegraph.find_by_any_name(search_config.name)
      end

      # Next unassigned devices from the given list.
      #
      # @param devices [Array<Y2Storage::Device>]
      # @param search [Config::Search]
      # @return [Y2Storage::Device, nil]
      def next_unassigned_devices(devices, search)
        devices
          .reject { |d| sids.include?(d.sid) }
          .sort_by(&:name)
          .first(search.max || devices.size)
      end

      # @see #search
      # @param config [#found_device]
      def add_found(config)
        found = config.found_device
        @sids << found.sid if found
      end
    end
  end
end
