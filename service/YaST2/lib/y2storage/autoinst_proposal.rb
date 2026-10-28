# Copyright (c) [2017] SUSE LLC
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
require "y2storage/proposal_settings"
require "y2storage/exceptions"
require "y2storage/planned"
require "y2storage/proposal"
require "y2storage/guided_proposal"

module Y2Storage
  # Class to calculate a storage proposal for autoinstallation
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
  class AutoinstProposal < Proposal::Base
    # @return [AutoinstProfile::PartitioningSection] Partitioning layout from an AutoYaST profile
    attr_reader :partitioning

    # @return [AutoinstIssues::List] List of found AutoYaST issues
    attr_reader :issues_list

    # @return [DiskSize] Missing space for the originally planned devices
    attr_reader :missing_space

    # Constructor
    #
    # @param partitioning [Array<Hash>] Partitioning schema from an AutoYaST profile
    # @param proposal_settings [Y2Storage::ProposalSettings] Guided proposal settings
    # @param devicegraph  [Devicegraph] starting point. If nil, then probed devicegraph
    #   will be used
    # @param disk_analyzer [DiskAnalyzer] by default, the method will create a new one
    #   based on the initial devicegraph or will use the one in {StorageManager} if
    #   starting from probed (i.e. 'devicegraph' argument is also missing)
    # @param issues_list [AutoinstIssues::List] List of AutoYaST issues to register them
    def initialize(partitioning: [], proposal_settings: nil, devicegraph: nil, disk_analyzer: nil,
      issues_list: nil)
      super(devicegraph: devicegraph, disk_analyzer: disk_analyzer)
      @issues_list = issues_list || ::Installation::AutoinstIssues::List.new
      @proposal_settings = proposal_settings
      @partitioning = AutoinstProfile::PartitioningSection.new_from_hashes(partitioning)
    end

    private

    # Calculates the proposal
    #
    # @raise [NoDiskSpaceError] if there is no enough space to perform the installation
    def calculate_proposal
      drives = Proposal::AutoinstDrivesMap.new(initial_devicegraph, partitioning, issues_list)
      if issues_list.fatal?
        @devices = nil
        return @devices
      end

      @devices = propose_devicegraph(initial_devicegraph, drives)
    end

    # Proposes a devicegraph based on given drives map
    #
    # This method falls back to #proposed_guided_devicegraph when the device map
    # does not contain any partition.
    #
    # @param devicegraph [Devicegraph]                 Starting point
    # @param drives      [Proposal::AutoinstDrivesMap] Devices map from an AutoYaST profile
    # @return [Devicegraph] Devicegraph containing the planned devices
    def propose_devicegraph(devicegraph, drives)
      if drives.partitions?
        @planned_devices = plan_devices(devicegraph, drives)

        devicegraph = clean_graph(devicegraph, drives, @planned_devices)
        add_partition_tables(devicegraph, drives)

        result = create_devices(devicegraph, @planned_devices, drives.disk_names)
        add_reduced_devices_issues(result)
        @missing_space = result.missing_space
        result.devicegraph
      else
        log.info "No partitions were specified. Falling back to guided setup planning."
        propose_guided_devicegraph(devicegraph, drives)
      end
    end

    # Add partition tables
    #
    # This method create/change partitions tables according to information
    # specified in the profile. Disks containing any partition will be ignored.
    #
    # The devicegraph which is passed as first argument will be modified.
    #
    # @param devicegraph [Devicegraph]                 Starting point
    # @param drives      [Proposal::AutoinstDrivesMap] Devices map from an AutoYaST profile
    def add_partition_tables(devicegraph, drives)
      drives.each do |disk_name, drive_spec|
        next if drive_spec.unwanted_partitions?

        disk = devicegraph.disk_devices.find { |d| d.name == disk_name }
        update_partition_table(disk, suitable_ptable_type(disk, drive_spec)) if disk
      end
    end

    # Determines which partition table type should be used
    #
    # @param disk        [Y2Storage::Disk] Disk to set the partition table on
    # @param drive_spec  [Y2Storage::AutoinstProfile::DriveSection] Drive section from the profile
    # @return [Y2Storage::PartitionTables::Type] Partition table type
    def suitable_ptable_type(disk, drive_spec)
      ptable_type = nil
      ptable_type = Y2Storage::PartitionTables::Type.find(drive_spec.disklabel) if drive_spec.disklabel

      disk_ptable_type = disk.partition_table ? disk.partition_table.type : nil
      ptable_type || disk_ptable_type || disk.preferred_ptable_type
    end

    # Update partition table
    #
    # It does nothing if current partition table type and wanted one are the same.
    # The disk object is modified.
    #
    # @param disk        [Y2Storage::Disk] Disk to set the partition table on
    # @param ptable_type [Y2Storage::PartitionTables::Type] Partition table type
    def update_partition_table(disk, ptable_type)
      return unless update_partition_table?(disk, ptable_type)

      disk.remove_descendants if disk.partition_table
      disk.create_partition_table(ptable_type)
    end

    # Determines whether the partition table must be updated
    #
    # @param disk        [Y2Storage::Disk] Disk to set the partition table on
    # @param ptable_type [Y2Storage::PartitionTables::Type] Partition table type
    def update_partition_table?(disk, ptable_type)
      disk.partitions.empty? &&
        (disk.partition_table.nil? || disk.partition_table.type != ptable_type)
    end

    # Add devices to make the system bootable
    #
    # The devicegraph which is passed as first argument will be modified.
    #
    # @param devicegraph [Devicegraph]         Starting point
    # @return [Array<Planned::DevicesCollection>] List of required planned devices to boot
    def boot_devices(devicegraph, devices)
      return unless root?(devices.mountable_devices)

      checker = BootRequirementsChecker.new(
        devicegraph,
        planned_devices: devices.mountable_devices,
        bootloader:      bootloader
      )
      begin
        result = checker.needed_partitions
      rescue BootRequirementsChecker::Error => e
        issues_list.add(Y2Storage::AutoinstIssues::CouldNotCalculateBoot)
        log.error e.message
        result = []
      end
      result
    end

    # Determines whether the list of devices includes a root partition
    #
    # @param  devices [Array<Planned:Device>] List of planned devices
    # @return [Boolean] true if there is a root partition; false otherwise.
    def root?(devices)
      return true if devices.any? { |d| d.respond_to?(:mount_point) && d.mount_point == "/" }

      issues_list.add(Y2Storage::AutoinstIssues::MissingRoot)
    end

    # Finds a suitable devicegraph using the initial guided proposal approach
    #
    # @see Y2Storage::GuidedProposal.initial
    #
    # @raise [Error] No suitable devicegraph was found
    #
    # @param devicegraph [Devicegraph] Starting point
    # @param drives [AutoinstDrivesMap] Devices map from an AutoYaST profile
    #
    # @return [Devicegraph] Proposed devicegraph using the guided proposal approach
    def propose_guided_devicegraph(devicegraph, drives)
      devicegraph = clean_graph(devicegraph, drives, [])

      settings = proposal_settings_for_disks(drives)

      proposal = GuidedProposal.initial(devicegraph: devicegraph, settings: settings)

      proposal.devices
    end

    # Calculates list of planned devices
    #
    # If the list does not contain any partition, then it follows the same
    # approach as the guided proposal
    #
    # @param devicegraph [Devicegraph]                 Starting point
    # @param drives      [Proposal::AutoinstDrivesMap] Devices map from an AutoYaST profile
    # @return [Planned::DevicesCollection] Devices to add
    def plan_devices(devicegraph, drives)
      planner = Proposal::AutoinstDevicesPlanner.new(devicegraph, issues_list)
      planner.planned_devices(drives)
    end

    # Clean a devicegraph according to an AutoYaST drives map
    #
    # @param devicegraph     [Devicegraph]       Starting point
    # @param drives          [AutoinstDrivesMap] Devices map from an AutoYaST profile
    # @param planned_devices [<Planned::DevicesCollection>] Planned devices
    # @return [Devicegraph] Clean devicegraph
    #
    # @see Y2Storage::Proposal::AutoinstSpaceMaker
    def clean_graph(devicegraph, drives, planned_devices)
      space_maker = Proposal::AutoinstSpaceMaker.new(disk_analyzer, issues_list)
      space_maker.cleaned_devicegraph(devicegraph, drives, planned_devices)
    end

    # Creates planned devices on a given devicegraph
    #
    # If adding boot devices makes impossible to create the rest of devices,
    # it will try again without them. In such a case, it will register an
    # issue.
    #
    # As a side effect, it updates the planned devices list if needed.
    #
    # @param devicegraph     [Devicegraph]                Starting point
    # @param planned_devices [Planned::DevicesCollection] Devices to add
    # @param disk_names      [Array<String>]              Names of the disks to consider
    # @return [Devicegraph] Copy of devicegraph containing the planned devices
    def create_devices(devicegraph, planned_devices, disk_names)
      boot_parts = boot_devices(devicegraph, @planned_devices)
      devices_creator = Proposal::AutoinstDevicesCreator.new(devicegraph, issues_list)
      begin
        planned_with_boot = planned_devices.prepend(boot_parts)
        result = devices_creator.populated_devicegraph(planned_with_boot, disk_names)
        @planned_devices = planned_with_boot
      rescue Y2Storage::NoDiskSpaceError
        raise if boot_parts.empty?

        result = devices_creator.populated_devicegraph(planned_devices, disk_names)
        issues_list.add(Y2Storage::AutoinstIssues::CouldNotCreateBoot, boot_parts)
      end
      result
    end

    # Add shrinked devices to the issues list
    #
    # @param result [Proposal::CreatorResult] Result after creating the planned devices
    def add_reduced_devices_issues(result)
      if !result.shrinked_partitions.empty?
        issues_list.add(Y2Storage::AutoinstIssues::ShrinkedPlannedDevices,
          result.shrinked_partitions)
      end
      if !result.shrinked_lvs.empty?
        issues_list.add(Y2Storage::AutoinstIssues::ShrinkedPlannedDevices,
          result.shrinked_lvs)
      end
      nil
    end

    # Returns the product's proposal settings for a given set of disks
    #
    # @param drives [Proposal::AutoinstDrivesMap] Devices map from an AutoYaST profile
    # @return [ProposalSettings] Proposal settings considering only the given disks
    #
    # @see Y2Storage::BlkDevice#name
    def proposal_settings_for_disks(drives)
      settings = @proposal_settings || ProposalSettings.new_for_current_product
      drives.use_snapshots? ? settings.force_enable_snapshots : settings.force_disable_snapshots
      settings.candidate_devices = drives.disk_names
      settings
    end

    # Bootloader type to use when calculating the boot partitions
    #
    # @return [BootloaderType]
    def bootloader
      settings = @proposal_settings || ProposalSettings.new_for_current_product
      settings.bootloader
    end
  end
end
