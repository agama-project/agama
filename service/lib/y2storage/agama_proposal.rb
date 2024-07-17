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
require "y2storage/agama_searcher"
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
    # @return [Agama::Storage::Profile]
    attr_reader :settings

    # @return [Agama::Config]
    attr_reader :config

    # @return [Array<Agama::Issue>] List of found issues
    attr_reader :issues_list

    # Constructor
    #
    # @param settings [Agama::Storage::Settings] proposal settings
    # @param config [Agama::Config]
    # @param devicegraph [Devicegraph] starting point. If nil, then probed devicegraph
    #   will be used
    # @param disk_analyzer [DiskAnalyzer] by default, the method will create a new one
    #   based on the initial devicegraph or will use the one in {StorageManager} if
    #   starting from probed (i.e. 'devicegraph' argument is also missing)
    # @param issues_list [Array<Agama::Issue] Array to register issues found during the process
    def initialize(initial_settings, config, devicegraph: nil, disk_analyzer: nil, issues_list: nil)
      super(devicegraph: devicegraph, disk_analyzer: disk_analyzer)
      @issues_list = issues_list || []
      @settings = initial_settings
      @config = config
    end

    private

    # Not sure if needed in the final version
    # @return [ProposalSettings]
    # attr_reader :guided_settings

    # @return [Proposal::SpaceMaker]
    attr_reader :space_maker

    # Calculates the proposal
    #
    # @raise [NoDiskSpaceError] if there is no enough space to perform the installation
    def calculate_proposal
      Proposal::AgamaSearcher.new(initial_devicegraph).search(settings, issues_list)
      if issues_list.any?(:error?)
        # This means some IfNotFound is set to "error" and we failed to find a match
        @devices = nil
        return @devices
      end

      @space_maker = Proposal::AgamaSpaceMaker.new(disk_analyzer, settings, config)
      @devices = propose_devicegraph(initial_devicegraph)
    end

    # Proposes a devicegraph based on given configuration
    #
    # @param devicegraph [Devicegraph]                 Starting point
    # @return [Devicegraph] Devicegraph containing the planned devices
    def propose_devicegraph(devicegraph)
      @planned_devices = initial_planned_devices(devicegraph)

      # This is from Guided
      raise Error if useless_volumes_sets?

      clean_devicegraph = clean_graph(devicegraph, @planned_devices)

      planner = Proposal::AgamaDevicesPlanner.new(settings)
      planner.add_boot_devices(@planned_devices, clean_devicegraph)

      # Almost for sure, this should happen as part of the creation of devices below
      add_partition_tables(devicegraph)

      result = create_devices(devicegraph, @planned_devices)
      result.devicegraph
    end

    # Add partition tables
    #
    # This method create/change partitions tables according to information
    # specified in the profile. Disks containing any partition will be ignored.
    #
    # The devicegraph which is passed as first argument will be modified.
    #
    # @param devicegraph [Devicegraph]                 Starting point
    def add_partition_tables(devicegraph)
      # TODO: if needed, will very likely be moved to AgamaDevicesCreator
    end

    # Calculates list of planned devices
    #
    # @param devicegraph [Devicegraph]                 Starting point
    # @return [Planned::DevicesCollection] Devices to add
    def initial_planned_devices(devicegraph)
      planner = Proposal::AgamaDevicesPlanner.new(settings, config)
      planner.initial_planned_devices(devicegraph)
    end

    # Clean a devicegraph 
    #
    # @return [Y2Storage::Devicegraph]
    def clean_graph(devicegraph, planned_devices)
      new_devicegraph = devicegraph.dup

      # TODO: remember the list of affected devices so we can restore their partition tables at
      # the end of the process for those devices that were not used (as soon as libstorage-ng
      # allows us to copy sub-graphs).
      remove_empty_partition_tables(new_devicegraph)

      protect_sids(planned_devices)
      # NOTE: take into account (partitions on) pre-existing RAIDs?
      partitions = partitions_for(planned_devices)
      space_maker.prepare_devicegraph(new_devicegraph, partitions)
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
      drive_sids = settings.drives.map(&:found_sid)
      devices = drive_sids.map { |n| devicegraph.find_device(n) }.compact
      devices.select { |d| d.partition_table && d.partitions.empty? }
		end

		# Planned partitions that will hold the given planned devices
		#
		# Extracted to a separate method because it's something that may need some extra logic
    # in the future. See the equivalent method at DevicegraphGenerator.
		#
		# @param planned_devices [Array<Planned::Device>] list of planned devices
		# @return [Array<Planned::Partition>]
		def partitions_for(planned_devices)
      planned_devices.select { |d| device.is_a?(Planned::Partition) }
		end

		# Configures SpaceMaker#protected_sids according to the given list of planned devices
    #
    # @param devices [Array<Planned::Device]
    def protect_sids(devices)
      space_maker.protected_sids = devices.select(&:reuse?).map(&:reuse_sid)
    end

    # Creates planned devices on a given devicegraph
    #
    def create_devices(devicegraph, planned_devices)
      # We are going to alter the volumes in several ways, so let's be a
      # good citizen and do it in our own copy
      planned_devices = planned_devices.map(&:dup)

      devices_creator = Proposal::AgamaDevicesCreator.new(devicegraph, issues_list)
      names = disk_names(devicegraph)
      protect_sids(planned_devices)
      result = devices_creator.populated_devicegraph(planned_devices, names, space_maker)
    end

    def disk_names(devicegraph)
      disk_sids = settings.drives.map(&:found_sid).compact
      disk_sids.map {|s| devicegraph.find_device(s) }
    end
  end
end
