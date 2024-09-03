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

require "yast"
require "y2storage/proposal"
require "y2storage/proposal/agama_searcher"
require "y2storage/proposal/agama_space_maker"
require "y2storage/proposal/agama_devices_planner"
require "y2storage/proposal/agama_devices_creator"
require "y2storage/proposal/planned_devices_handler"
require "y2storage/exceptions"
require "y2storage/planned"

module Y2Storage
  # Class to calculate a storage proposal for auto-installation using Agama.
  #
  # @note The storage config (initial_settings param in constructor) is modified in several ways:
  #   * The search configs are resolved.
  #   * Every config with an unfound search (e.g., a drive config, a partition config) is removed if
  #     its search has #if_not_found set to skip.
  #
  #   It would be preferable to work over a copy instead of modifying the given config. In some
  #   cases, the config object is needed to generate its JSON format. The JSON result would not
  #   be 100% accurate if some elements are removed.
  #
  #   The original config without removing elements is needed if:
  #     * The current proposal is the initial proposal automatically calculated by Agama. In
  #       this case, the config is generated from the product definition. The config JSON format is
  #       obtained by converting the config object to JSON.
  #     * The current proposal was calculated from a settings following the guided schema. This
  #       usually happens when a proposal is calculated from the UI. In this case, a config is
  #       generated from the guided settings. The config JSON format is obtained by converting the
  #       config object to JSON.
  #
  #   In those two cases (initial proposal and proposal from guided settings) no elements are
  #   removed from the config because it has no searches with skip:
  #     * The config from the product definition has a drive that fails with unfound search (i.e.,
  #       there is no candidate device for installing the system).
  #     * The config from the guided settings has all drives and partitions with search set to
  #       error. The proposal fails if the selected devices are not found.
  #
  #   In the future there could be any other scenario in which it would be needed to keep all the
  #   elements from an initial config containing searches with skip.
  #
  # @example Creating a proposal from the current Agama configuration
  #   config = Agama::Storage::Config.new_from_json(config_json)
  #   proposal = Y2Storage::AgamaProposal.new(config)
  #   proposal.proposed?            # => false
  #   proposal.devices              # => nil
  #   proposal.planned_devices      # => nil
  #
  #   proposal.propose              # Performs the calculation
  #
  #   proposal.proposed?            # => true
  #   proposal.devices              # => Proposed layout
  #
  class AgamaProposal < Proposal::Base
    include Proposal::PlannedDevicesHandler

    # @return [Agama::Storage::Config]
    attr_reader :settings

    # @return [Array<Agama::Issue>] List of found issues
    attr_reader :issues_list

    # Constructor
    #
    # @param initial_settings [Agama::Storage::Config] Agama storage settings
    # @param devicegraph [Devicegraph] starting point. If nil, then probed devicegraph
    #   will be used
    # @param disk_analyzer [DiskAnalyzer] by default, the method will create a new one
    #   based on the initial devicegraph or will use the one from the StorageManager if
    #   starting from probed (i.e. 'devicegraph' argument is also missing)
    # @param issues_list [Array<Agama::Issue] Array to register issues found during the process
    def initialize(initial_settings, devicegraph: nil, disk_analyzer: nil, issues_list: nil)
      super(devicegraph: devicegraph, disk_analyzer: disk_analyzer)
      @issues_list = issues_list || []
      @settings = initial_settings
    end

  private

    # @return [Proposal::SpaceMaker]
    attr_reader :space_maker

    # Whether the list of issues generated so far already includes any serious error
    #
    # @return [Boolean]
    def fatal_error?
      issues_list.any?(&:error?)
    end

    # Calculates the proposal
    #
    # @raise [NoDiskSpaceError] if there is no enough space to perform the installation
    def calculate_proposal
      # TODO: Could the search be moved to the devices planner? If so, the settings object might
      #   keep untouched, directly generating planned devices associated to the found device and
      #   skipping planned devices for searches with skip if not found.
      Proposal::AgamaSearcher
        .new(initial_devicegraph)
        .search(settings, issues_list)

      if fatal_error?
        # This means some IfNotFound is set to "error" and we failed to find a match
        @devices = nil
        return @devices
      end

      @space_maker = Proposal::AgamaSpaceMaker.new(disk_analyzer, settings)
      @devices = propose_devicegraph
    end

    # Proposes a devicegraph based on given configuration
    #
    # @return [Devicegraph, nil] Devicegraph containing the planned devices, nil if the proposal
    #   failed
    def propose_devicegraph
      devicegraph = initial_devicegraph.dup

      calculate_initial_planned(devicegraph)
      return if fatal_error?

      configure_ptable_types(devicegraph)
      clean_graph(devicegraph)
      complete_planned(devicegraph)
      return if fatal_error?

      result = create_devices(devicegraph)
      result.devicegraph
    end

    # Fills the list of planned devices, excluding partitions from the boot requirements checker
    #
    # @return [Planned::DevicesCollection]
    def calculate_initial_planned(devicegraph)
      planner = Proposal::AgamaDevicesPlanner.new(settings, issues_list)
      @planned_devices = planner.initial_planned_devices(devicegraph)
    end

    # Performs the mandatory space-making actions on the given devicegraph
    #
    # @param devicegraph [Devicegraph] the graph gets modified
    def clean_graph(devicegraph)
      remove_empty_partition_tables(devicegraph)
      protect_sids
      space_maker.prepare_devicegraph(devicegraph, partitions_for_clean)
    end

    # Configures the disk devices on the given devicegraph to prefer the appropriate partition table
    # types, if any partition table needs to be created later during the proposal
    #
    # @param devicegraph [Devicegraph] the graph gets modified
    def configure_ptable_types(devicegraph)
      configured = settings.drives.select(&:ptable_type)
      configured.each do |drive|
        dev = device_for(drive, devicegraph)
        next unless dev

        dev.forced_ptable_type = drive.ptable_type
      end
    end

    # Modifies the list of planned devices, removing shadowed subvolumes and adding any planned
    # partition needed for booting the new target system
    #
    # @param devicegraph [Devicegraph]
    def complete_planned(devicegraph)
      if settings.boot.configure?
        @planned_devices = planned_devices.prepend(boot_partitions(devicegraph))
      end

      remove_shadowed_subvols(planned_devices)
    end

    # @see #complete_planned
    def boot_partitions(devicegraph)
      checker = BootRequirementsChecker.new(
        devicegraph,
        planned_devices: planned_devices.mountable_devices,
        boot_disk_name:  settings.boot_device
      )
      # NOTE: Should we try with :desired first?
      checker.needed_partitions(:min)
    rescue BootRequirementsChecker::Error => e
      raise NotBootableError, e.message
    end

    # Removes partition tables from candidate devices with empty partition table
    #
    # @param devicegraph [Devicegraph] the graph gets modified
    # @return [Array<Integer>] sid of devices where partition table was deleted from
    def remove_empty_partition_tables(devicegraph)
      devices = drives_with_empty_partition_table(devicegraph)
      devices.each(&:delete_partition_table)
      devices.map(&:sid)
    end

    # All candidate devices with an empty partition table
    #
    # @param devicegraph [Y2Storage::Devicegraph]
    # @return [Array<Y2Storage::BlkDevice>]
    def drives_with_empty_partition_table(devicegraph)
      devices = settings.drives.map { |d| device_for(d, devicegraph) }.compact
      devices.select { |d| d.partition_table && d.partitions.empty? }
    end

    # Planned partitions that will hold the given planned devices
    #
    # @return [Array<Planned::Partition>]
    def partitions_for_clean
      # The current logic is quite trivial, but this is implemented as a separate method because
      # some extra logic is expected in the future (eg. considering partitions on pre-existing
      # RAIDs and more stuff). See the equivalent method at DevicegraphGenerator.
      planned_devices.partitions
    end

    # Configures SpaceMaker#protected_sids according to the given list of planned devices
    def protect_sids
      space_maker.protected_sids = planned_devices.all.select(&:reuse?).map(&:reuse_sid)
    end

    # Creates the planned devices on a given devicegraph
    #
    # @param devicegraph [Devicegraph] the graph gets modified
    def create_devices(devicegraph)
      devices_creator = Proposal::AgamaDevicesCreator.new(devicegraph, issues_list)
      names = settings.drives.map(&:found_device).compact.map(&:name)
      protect_sids
      result = devices_creator.populated_devicegraph(planned_devices, names, space_maker)
    end

    # Equivalent device at the given devicegraph for the given configuration setting (eg. drive)
    #
    # @param drive [Agama::Storage::Configs::Drive]
    # @param devicegraph [Devicegraph]
    # @return [Device]
    def device_for(drive, devicegraph)
      return unless drive.found_device

      devicegraph.find_device(drive.found_device.sid)
    end
  end
end
