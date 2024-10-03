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

require "agama/storage/config_checker"
require "agama/storage/config_solver"
require "yast"
require "y2storage/exceptions"
require "y2storage/planned"
require "y2storage/proposal"
require "y2storage/proposal/agama_devices_creator"
require "y2storage/proposal/agama_devices_planner"
require "y2storage/proposal/agama_space_maker"
require "y2storage/proposal/planned_devices_handler"

module Y2Storage
  # Class to calculate a storage proposal for Agama.
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
    attr_reader :config

    # @return [Array<Agama::Issue>] List of found issues
    attr_reader :issues_list

    # @note The storage config (first param) is modified in several ways:
    #   * The search configs are solved.
    #   * The sizes are solved (setting the size of the selected device, assigning fallbacks, etc).
    #
    # @param config [Agama::Storage::Config]
    # @param product_config [Agama::Config]
    # @param devicegraph [Devicegraph] Starting point. If nil, then probed devicegraph will be used.
    # @param disk_analyzer [DiskAnalyzer] By default, the method will create a new one based on the
    #   initial devicegraph or will use the one from the StorageManager if starting from probed
    #   (i.e. 'devicegraph' argument is also missing).
    # @param issues_list [Array<Agama::Issue] Array to register issues found during the process.
    def initialize(config,
      product_config: nil, devicegraph: nil, disk_analyzer: nil, issues_list: nil)
      super(devicegraph: devicegraph, disk_analyzer: disk_analyzer)
      @config = config
      @product_config = product_config || Agama::Config.new
      @issues_list = issues_list || []
    end

  private

    # @return [Agama::Config]
    attr_reader :product_config

    # @return [Proposal::AgamaSpaceMaker]
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
      Agama::Storage::ConfigSolver
        .new(initial_devicegraph, product_config)
        .solve(config)

      issues = Agama::Storage::ConfigChecker
        .new(config, product_config)
        .issues

      issues_list.concat(issues)

      if fatal_error?
        # This means some IfNotFound is set to "error" and we failed to find a match
        @devices = nil
        return @devices
      end

      @space_maker = Proposal::AgamaSpaceMaker.new(disk_analyzer, config)
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
      devicegraph = clean_graph(devicegraph)
      complete_planned(devicegraph)
      return if fatal_error?

      result = create_devices(devicegraph)
      result.devicegraph
    end

    # Fills the list of planned devices, excluding partitions from the boot requirements checker
    #
    # @return [Planned::DevicesCollection]
    def calculate_initial_planned(devicegraph)
      planner = Proposal::AgamaDevicesPlanner.new(devicegraph, issues_list)
      @planned_devices = planner.planned_devices(config)
    end

    # Performs the mandatory space-making actions on the given devicegraph
    #
    # @param devicegraph [Devicegraph] the graph gets modified
    def clean_graph(devicegraph)
      remove_empty_partition_tables(devicegraph)
      # {Proposal::SpaceMaker#prepare_devicegraph} returns a copy of the given devicegraph.
      space_maker.prepare_devicegraph(devicegraph, disks_for_clean)
    end

    # Configures the disk devices on the given devicegraph to prefer the appropriate partition table
    # types, if any partition table needs to be created later during the proposal
    #
    # @param devicegraph [Devicegraph] the graph gets modified
    def configure_ptable_types(devicegraph)
      configured = config.drives.select(&:ptable_type)
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
      if config.boot.configure?
        @planned_devices = planned_devices.prepend(boot_partitions(devicegraph))
      end

      remove_shadowed_subvols(planned_devices)
    end

    # @see #complete_planned
    def boot_partitions(devicegraph)
      checker = BootRequirementsChecker.new(
        devicegraph,
        planned_devices: planned_devices.mountable_devices,
        boot_disk_name:  config.boot_device
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
      devices = config.drives.map { |d| device_for(d, devicegraph) }.compact
      devices.select { |d| d.partition_table && d.partitions.empty? }
    end

    # Devices for which the mandatory actions must be executed
    #
    # @return [Array<String>] names of partitionable devices
    def disks_for_clean
      return drives_names if config.boot_device.nil? || drives_names.include?(config.boot_device)

      drives_names + [config.boot_device]
    end

    # Creates the planned devices on a given devicegraph
    #
    # @param devicegraph [Devicegraph] the graph gets modified
    def create_devices(devicegraph)
      devices_creator = Proposal::AgamaDevicesCreator.new(devicegraph, issues_list)
      result = devices_creator.populated_devicegraph(planned_devices, drives_names, space_maker)
    end

    # Names of all the devices that correspond to a drive from the config
    #
    # @return [Array<String>]
    def drives_names
      @drives_names ||= config.drives.map(&:found_device).compact.map(&:name)
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
