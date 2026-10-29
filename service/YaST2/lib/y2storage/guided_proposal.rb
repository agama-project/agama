# Copyright (c) [2016-2024] SUSE LLC
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
require "y2storage/proposal_settings"
require "y2storage/exceptions"

module Y2Storage
  # Class to calculate a storage proposal to install the system
  #
  # @example
  #   proposal = Y2Storage::GuidedProposal.new
  #   proposal.settings.use_separate_home = true
  #   proposal.proposed?                          # => false
  #   proposal.devices                            # => nil
  #   proposal.planned_devices                    # => nil
  #
  #   proposal.propose                            # Performs the calculation
  #
  #   proposal.proposed?                          # => true
  #   proposal.devices                            # => Proposed layout
  #   proposal.settings.use_separate_home = false # raises RuntimeError
  class GuidedProposal < Proposal::Base
    # @overload settings
    #
    #   Settings for calculating the proposal.
    #
    #   @note The settings cannot be modified once the proposal has been calculated
    #
    #   @return [ProposalSettings]
    attr_reader :settings

    class << self
      # Calculates the initial proposal
      #
      # If a proposal is not possible by honoring current settings, other settings
      # are tried. For example, a proposal without separate home or without snapshots
      # will be calculated.
      #
      # @see InitialGuidedProposal
      # @see #initialize
      #
      # @param settings [ProposalSettings]
      # @param devicegraph [Devicegraph]
      # @param disk_analyzer [DiskAnalyzer]
      #
      # @return [InitialGuidedProposal]
      def initial(settings: nil, devicegraph: nil, disk_analyzer: nil)
        settings.encryption_pbkdf = GuidedProposal.check_pbkdf(settings.encryption_pbkdf) if settings
        proposal = InitialGuidedProposal.new(
          settings:      settings,
          devicegraph:   devicegraph,
          disk_analyzer: disk_analyzer
        )

        proposal.propose
        proposal
      rescue Y2Storage::Error
        log.error("Initial proposal failed")
        proposal
      end

      # Checks if the given pbkdf can be used for the installation.
      #
      # @param pbkdf which has to be checked [PbkdFunction]
      # @return updated PbkdFunction
      def check_pbkdf(pbkdf)
        # none efi system has to use PBKDF2
        unless Y2Storage::Arch.new.efiboot?
          log.info "Using PBKDF2 because it is not a EFI system."
          return PbkdFunction::PBKDF2
        end
        pbkdf
      end
    end

    # Constructor
    #
    # @param settings [ProposalSettings] if nil, default settings will be used
    # @param devicegraph [Devicegraph] starting point. If nil, the probed devicegraph
    #   will be used.
    # @param disk_analyzer [DiskAnalyzer] by default, the method will create a new one
    #   based on the initial {devicegraph} or will use the one in {StorageManager} if
    #   starting from probed (i.e. {devicegraph} argument is also missing).
    def initialize(settings: nil, devicegraph: nil, disk_analyzer: nil)
      super(devicegraph: devicegraph, disk_analyzer: disk_analyzer)

      @settings = settings || ProposalSettings.new_for_current_product
      @settings.encryption_pbkdf = GuidedProposal.check_pbkdf(@settings.encryption_pbkdf)
    end

    private

    # @return [ProposalSettings]
    attr_writer :settings

    # Calculates the proposal
    #
    # @see #try_proposal
    #
    # @raise [Error, NoDiskSpaceError] if there is no enough space to perform the installation
    #
    # @return [true]
    def calculate_proposal
      try_proposal
    ensure
      settings.freeze
    end

    # Tries to perform a proposal
    #
    # Settings might be completed with default values for candidate devices and root device.
    #
    # This method is intended to be redefined for derived classes, see {InitialGuidedProposal}.
    #
    # @raise [Error, NoDiskSpaceError] if it was not possible to calculate the proposal
    #
    # @return [true]
    def try_proposal
      complete_settings

      try_with_each_target_size
    end

    # Generic method that tries to execute a block on each element of a
    # collection, returning the first successful result
    #
    # If a {Y2Storage::Error} exception is raised, it tries with the
    # next element of the collection. It returns the result of the first
    # execution of the passed block that succeeds (i.e. that does not raise an
    # Error exception).
    #
    # @raise [Exception] when the block fails for all elements in the collection
    #
    # @param iterator [#each] collection to iterate
    # @param error_proc [Proc, nil] optional code to execute before trying the next
    #   item when an exception is raised
    def try_with_each(iterator, error_proc: nil)
      error = default_proposal_error

      iterator.each do |item|
        return yield(item)
      rescue Error => e
        error_proc&.call(e, item)
        next

      end

      raise error
    end

    # Helper method to do a proposal attempt for each possible target size
    #
    # @see #target_sizes
    #
    # @raise [Error, NoDiskSpaceError] if it was not possible to calculate the proposal
    #
    # @return [true]
    def try_with_each_target_size
      log_error = proc do |e, target_size|
        log.info "Failed to make a proposal with target size: #{target_size}"
        log.info "Error: #{e.message}"
      end

      try_with_each(target_sizes, error_proc: log_error) do |target_size|
        try_with_target(target_size)
      end
    end

    # Helper method to do a proposal attempt with the given target size
    #
    # @raise [Error, NoDiskSpaceError] if it was not possible to calculate the proposal
    #
    # @param target_size [Symbol] see {#target_sizes}
    # @return [true]
    def try_with_target(target_size)
      log.info "Trying to make a proposal with target size: #{target_size}\n" \
               "using the following settings:\n#{settings}"

      # Calculate the planned devices even before checking #useless_volumes_sets?
      # because they can contain useful information
      @planned_devices = initial_planned_devices(target_size)
      raise Error if useless_volumes_sets?

      @devices = devicegraph(target_size)
      true
    end

    # All possible target sizes to make the proposal
    #
    # @return [Array<Symbol>]
    def target_sizes
      [:desired, :min]
    end

    # Default error when it is not possible to create a proposal
    #
    # @return [NoDiskSpaceError]
    def default_proposal_error
      NoDiskSpaceError.new("No usable disks detected")
    end

    # Completes the current settings with reasonable fallback values
    #
    # All settings coming from the control file have a fallback value, but there are some
    # settings that are only given by the user, for example: candidate_devices and
    # root_device. For those settings, some reasonable fallback values are given.
    def complete_settings
      settings.candidate_devices ||= candidate_devices
      settings.root_device ||= candidate_devices.first
    end

    # @return [Array<Planned::Device>]
    def initial_planned_devices(target)
      planner = Proposal::DevicesPlanner.new(settings)
      planner.volumes_planned_devices(target, initial_devicegraph)
    end

    # Devicegraph resulting of accommodating the planned devices and the boot-related
    # partitions in the initial devicegraph
    #
    # Note this method modifies the list of planned devices to add partitions needed for
    # booting and to reuse existing swap devices if possible.
    #
    # @param target_size [Symbol] see {#target_sizes}
    # @return [Devicegraph]
    def devicegraph(target_size)
      planner = Proposal::DevicesPlanner.new(settings)
      planner.add_boot_devices(@planned_devices, target_size, clean_graph)
      swap = Proposal::SwapReusePlanner.new(settings, clean_graph)
      swap.adjust_devices(@planned_devices)

      graph_generator.devicegraph(planned_devices, clean_graph)
    end

    def graph_generator
      @graph_generator ||= Proposal::DevicegraphGenerator.new(settings, disk_analyzer)
    end

    # Copy of #initial_devicegraph without all the partitions that must be wiped out
    # according to the settings. Empty partition tables are deleted from candidate
    # devices.
    #
    # @return [Y2Storage::Devicegraph]
    def clean_graph
      return @clean_graph if @clean_graph

      new_devicegraph = initial_devicegraph.dup

      # TODO: remember the list of affected devices so we can restore their partition tables at
      # the end of the process for those devices that were not used (as soon as libstorage-ng
      # allows us to copy sub-graphs).
      remove_empty_partition_tables(new_devicegraph)

      @clean_graph = graph_generator.prepared(@planned_devices, new_devicegraph)
    end

    # Removes partition tables from candidate devices with empty partition table
    #
    # @note The devicegraph is modified.
    #
    # @param devicegraph [Y2Storage::Devicegraph]
    # @return [Array<Integer>] sid of devices where partition table was deleted from
    def remove_empty_partition_tables(devicegraph)
      devices = candidate_devices_with_empty_partition_table(devicegraph)
      devices.each(&:delete_partition_table)
      devices.map(&:sid)
    end

    # All candidate devices with an empty partition table
    #
    # @param devicegraph [Y2Storage::Devicegraph]
    # @return [Array<Y2Storage::BlkDevice>]
    def candidate_devices_with_empty_partition_table(devicegraph)
      device_names = settings.candidate_devices
      devices = device_names.map { |n| devicegraph.find_by_name(n) }.compact
      devices.select { |d| d.partition_table && d.partitions.empty? }
    end

    # Candidate devices to make a proposal
    #
    # The candidate devices are calculated when current settings do not contain any
    # candidate device. See {#fallback_candidates}
    #
    # @return [Array<String>] e.g. ["/dev/sda", "/dev/sdc"]
    def candidate_devices
      settings.candidate_devices || fallback_candidates
    end

    # Candidate devices to make a proposal, full version
    #
    # Unlike {#candidate_devices}, that only returns a list of device names, this method
    # returns a list of proper full-featured objects representing those devices.
    #
    # @return [Array<BlkDevice>]
    def candidate_objects
      candidate_devices.map { |n| initial_devicegraph.find_by_name(n) }.compact
    end

    # Candidate devices to use when the current settings do not specify any, i.e. in the initial
    # attempt, before the user has had any opportunity to select the candidate devices
    #
    # The possible candidate devices are sorted, placing boot-optimized devices at the beginning and
    # removable devices (like USB) at the end.
    #
    # @return [Array<String>] e.g. ["/dev/sda", "/dev/sdc"]
    def fallback_candidates
      # NOTE: sort_by it is not being used here because "the result is not guaranteed to be stable"
      # see https://ruby-doc.org/core-2.5.0/Enumerable.html#method-i-sort_by
      # In addition, a partition makes more sense here since we only are "grouping" available disks
      # in three groups and arranging those groups.
      candidates = disk_analyzer.candidate_disks
      high_prio, rest = candidates.partition(&:boss?)
      low_prio, rest = rest.partition { |d| maybe_removable?(d) }
      candidates = high_prio + rest + low_prio
      candidates.first(fallback_candidates_size).map(&:name)
    end

    # Number of disks to be included in {#fallback_candidates}
    #
    # Without this limit, the process to find the optimal layout can be very slow
    # specially if LVM is enabled by default for the product. See bsc#1154070.
    #
    # @return [Integer]
    def fallback_candidates_size
      # Reasonable value set after research in bsc#1154070. Anyways, users with more disks will
      # very likely dismiss the initial proposal and use the Guided Setup or the Expert Partitioner.
      # Trying with more combinations of disks is often just wasting time.
      disks = 5

      return disks unless settings.allocate_mode?(:device)

      [disks, proposed_volumes_sets.size].max
    end

    # Whether the given device is potentially a removable disk
    #
    # It's not always possible to detect whether a given device is physically removable or not (eg.
    # a fixed device may be connected to the USB bus or an SD card may be internal), but this
    # returns true if the device is suspicious enough so it's better to avoid it in the automatic
    # proposal if possible.
    #
    # @param device [BlkDevice]
    # @return [boolean]
    def maybe_removable?(device)
      return true if dev_is?(device, :sd_card?)
      return true if dev_is?(device, :usb?)
      return true if dev_is?(device, :firewire?)

      false
    end

    # Checks whether the given device returns true for the given method
    #
    # @see #maybe_removable?
    #
    # @param device [BlkDevice]
    # @param method [Symbol]
    # @return [boolean]
    def dev_is?(device, method)
      return false unless device.respond_to?(method)

      device.public_send(method)
    end

    # All proposed volumes sets from the settings
    #
    # @return [Array<VolumeSpecificationsSet>]
    def proposed_volumes_sets
      settings.volumes_sets.select(&:proposed?)
    end

    # Checks whether the current distribution of volumes sets into disks make any sense
    #
    # NOTE: This method is only intended to make a quick evaluation to early discard
    # a combination of disks. A false result doesn't imply the proposal will succeed.
    #
    # @return [Boolean] true if there is some disk that is supposed to allocate volumes
    #   that are bigger than the size of the disk
    def useless_volumes_sets?
      candidate_objects.any? do |disk|
        total = DiskSize.sum(proposed_volumes_sets.select { |s| s.device == disk.name }.map(&:min_size))
        # We use ">=" because the whole space of the disk can never be used to allocate
        # the volumes (the partition table takes space)
        if total >= disk.size
          log.info "Discarded combination of volumes sets for #{disk.name} (#{total} >= #{disk.size})"
          true
        end
      end
    end
  end
end
