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
        config.drives.each do |drive_config|
          device = find_drive(drive_config.search)
          drive_config.search.solve(device)

          add_found(drive_config)

          next unless drive_config.found_device && drive_config.partitions?

          drive_config.partitions.each do |partition_config|
            next unless partition_config.search

            partition = find_partition(partition_config.search, drive_config.found_device)
            partition_config.search.solve(partition)
            add_found(partition_config)
          end
        end
      end

    private

      # @return [Devicegraph]
      attr_reader :devicegraph

      # @return [Array<Integer>] SIDs of the devices that are already associated to another search.
      attr_reader :sids

      # Finds a drive matching the given search config.
      #
      # @param search_config [Agama::Storage::Configs::Search]
      # @return [Y2Storage::Device, nil]
      def find_drive(search_config)
        candidates = candidate_devices(search_config, default: devicegraph.blk_devices)
        candidates.select! { |d| d.is?(:disk_device, :stray_blk_device) }
        next_unassigned_device(candidates)
      end

      # Finds a partitions matching the given search config.
      #
      # @param search_config [Agama::Storage::Configs::Search]
      # @return [Y2Storage::Device, nil]
      def find_partition(search_config, device)
        candidates = candidate_devices(search_config, default: device.partitions)
        candidates.select! { |d| d.is?(:partition) }
        next_unassigned_device(candidates)
      end

      # Candidate devices for the given search config.
      #
      # @param search_config [Agama::Storage::Configs::Search]
      # @param default [Array<Y2Storage::Device>] Candidates if the search does not indicate
      #   conditions.
      # @return [Array<Y2Storage::Device>]
      def candidate_devices(search_config, default: [])
        return default if search_config.any_device?

        [find_device(search_config)].compact
      end

      # Performs a search in the devicegraph to find a device matching the given search config.
      #
      # @param search_config [Agama::Storage::Configs::Search]
      # @return [Y2Storage::Device]
      def find_device(search_config)
        devicegraph.find_by_any_name(search_config.name)
      end

      # Next unassigned device from the given list.
      #
      # @param devices [Array<Y2Storage::Device>]
      # @return [Y2Storage::Device, nil]
      def next_unassigned_device(devices)
        devices
          .reject { |d| sids.include?(d.sid) }
          .min_by(&:name)
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
