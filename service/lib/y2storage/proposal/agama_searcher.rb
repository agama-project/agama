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

require "agama/issue"

module Y2Storage
  module Proposal
    # Auxiliary class to handle the 'search' elements within a storage configuration
    class AgamaSearcher
      include Yast::Logger
      include Yast::I18n

      # @param devicegraph [Devicegraph] used to find the corresponding devices that will get
      #   associated to each search element.
      def initialize(devicegraph)
        textdomain "agama"

        @devicegraph = devicegraph
      end

      # Resolve all the 'search' elements within a given configuration
      #
      # The first argument (the storage configuration) gets modified in several ways:
      #
      #   - All its 'search' elements get resolved, associating devices from the devicegraph
      #     (first argument) if some is found.
      #   - Some device definitions can get removed if configured to be skipped in absence of a
      #     corresponding device
      #
      # The second argument (the list of issues) gets modified by adding any found problem.
      #
      # @param config [Agama::Storage::Config] storage configuration containing device definitions
      #   like drives, volume groups, etc.
      # @param issues_list [Array<Agama::Issue>]
      def search(config, issues_list)
        @sids = []
        config.drives.each do |drive_config|
          device = find_drive(drive_config.search)
          drive_config.search.resolve(device)

          process_element(drive_config, config.drives, issues_list)

          next unless drive_config.found_device && drive_config.partitions?

          drive_config.partitions.each do |partition_config|
            next unless partition_config.search

            partition = find_partition(partition_config.search, drive_config.found_device)
            partition_config.search.resolve(partition)
            process_element(partition_config, drive_config.partitions, issues_list)
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

      # Perfomrs a search in the devicegraph to find a device matching the given search config.
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
      def process_element(element, collection, issues_list)
        found = element.found_device
        if found
          @sids << found.sid
        else
          issues_list << not_found_issue(element)
          collection.delete(element) if element.search.skip_device?
        end
      end

      # Issue generated if a corresponding device is not found for the given element
      #
      # @param element [Agama::Storage::Configs::Drive, Agama::Storage::Configs::Partition]
      # @return [Agama::Issue]
      def not_found_issue(element)
        Agama::Issue.new(
          issue_message(element),
          source:   Agama::Issue::Source::CONFIG,
          severity: issue_severity(element.search)
        )
      end

      # @see #not_found_issue
      def issue_message(element)
        if element.is_a?(Agama::Storage::Configs::Drive)
          if element.search.skip_device?
            _("No device found for an optional drive")
          else
            _("No device found for a mandatory drive")
          end
        elsif element.search.skip_device?
          _("No device found for an optional partition")
        else
          _("No device found for a mandatory partition")
        end
      end

      # @see #not_found_issue
      def issue_severity(search)
        return Agama::Issue::Severity::WARN if search.skip_device?

        Agama::Issue::Severity::ERROR
      end
    end
  end
end
