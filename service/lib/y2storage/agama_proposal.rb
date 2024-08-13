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
require "y2storage/exceptions"
require "y2storage/planned"

module Y2Storage
  # Class to calculate a storage proposal for autoinstallation using Agama
  #
  # @example Creating a proposal from the current AutoYaST profile
  #   partitioning = Yast::Profile.current["partitioning"]
  #   proposal = Y2Storage::AutoinstProposal.new(partitioning: partitioning)
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
    # @return [Agama::Storage::Config]
    attr_reader :settings

    # @return [Array<Agama::Issue>] List of found issues
    attr_reader :issues_list

    # Constructor
    #
    # @param settings [Agama::Storage::Settings] proposal settings
    # @param devicegraph [Devicegraph] starting point. If nil, then probed devicegraph
    #   will be used
    # @param disk_analyzer [DiskAnalyzer] by default, the method will create a new one
    #   based on the initial devicegraph or will use the one in {StorageManager} if
    #   starting from probed (i.e. 'devicegraph' argument is also missing)
    # @param issues_list [Array<Agama::Issue] Array to register issues found during the process
    def initialize(initial_settings, devicegraph: nil, disk_analyzer: nil, issues_list: nil)
      super(devicegraph: devicegraph, disk_analyzer: disk_analyzer)
      @issues_list = issues_list || []
      @settings = initial_settings
    end

    private

    # Not sure if needed in the final version
    # @return [ProposalSettings]
    # attr_reader :guided_settings

    # @return [Proposal::SpaceMaker]
    attr_reader :space_maker

    def fatal_error?
      issues_list.any?(&:error?)
    end

    # Calculates the proposal
    #
    # @raise [NoDiskSpaceError] if there is no enough space to perform the installation
    def calculate_proposal
      Proposal::AgamaSearcher.new.search(initial_devicegraph, settings, issues_list)
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
    # @param devicegraph [Devicegraph]                 Starting point
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

    def calculate_initial_planned(devicegraph)
      planner = Proposal::AgamaDevicesPlanner.new(settings, issues_list)
      @planned_devices = planner.initial_planned_devices(devicegraph)
    end

    # Clean a devicegraph
    #
    # @return [Y2Storage::Devicegraph]
    def clean_graph(devicegraph)
      remove_empty_partition_tables(devicegraph)
      protect_sids
      space_maker.prepare_devicegraph(devicegraph, partitions_for_clean)
    end

    def configure_ptable_types(devicegraph)
      configured = settings.drives.select(&:ptable_type)
      configured.each do |drive|
        dev = device_for(drive, devicegraph)
        next unless dev

        dev.forced_ptable_type = drive.ptable_type
      end
    end

    # Modifies the given list of planned devices, removing shadowed subvolumes and
    # adding any planned partition needed for booting the new target system
    #
    # @param devicegraph [Devicegraph]
    def complete_planned(devicegraph)
      if settings.boot.configure?
        @planned_devices = planned_devices.prepend(boot_partitions(devicegraph))
      end

      planned_devices.remove_shadowed_subvols
    end

    def boot_partitions(devicegraph)
      checker = BootRequirementsChecker.new(
        devicegraph,
        planned_devices: planned_devices.mountable_devices,
        boot_disk_name: settings.boot_device
      )
      # NOTE: Should we try with :desired first?
      checker.needed_partitions(:min)
    rescue BootRequirementsChecker::Error => e
      raise NotBootableError, e.message
    end

    # Removes partition tables from candidate devices with empty partition table
    #
    # @note The devicegraph is modified.
    #
    # @param devicegraph [Y2Storage::Devicegraph]
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
    # TODO:
    # Extracted to a separate method because it's something that may need some extra logic
    # in the future. See the equivalent method at DevicegraphGenerator.
    #
    # @param planned_devices [Array<Planned::Device>] list of planned devices
    # @return [Array<Planned::Partition>]
    def partitions_for_clean
      # NOTE: take into account (partitions on) pre-existing RAIDs?
      planned_devices.partitions
    end

    # Configures SpaceMaker#protected_sids according to the given list of planned devices
    def protect_sids
      space_maker.protected_sids = planned_devices.all.select(&:reuse?).map(&:reuse_sid)
    end

    # Creates planned devices on a given devicegraph
    #
    def create_devices(devicegraph)
      devices_creator = Proposal::AgamaDevicesCreator.new(devicegraph, issues_list)
      names = settings.drives.map(&:found_device).compact.map(&:name)
      protect_sids
      result = devices_creator.populated_devicegraph(planned_devices, names, space_maker)
    end

    def device_for(drive, devicegraph)
      return unless drive.found_device

      devicegraph.find_device(drive.found_device.sid)
    end
  end
end
