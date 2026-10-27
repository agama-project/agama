# Copyright (c) [2018-2021] SUSE LLC
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
require "y2storage/exceptions"

module Y2Storage
  # Class to calculate the initial storage proposal
  #
  # @see GuidedProposal
  class InitialGuidedProposal < GuidedProposal
    # Constructor
    #
    # @see GuidedProposal#initialize
    #
    # @param settings [ProposalSettings]
    # @param devicegraph [Devicegraph]
    # @param disk_analyzer [DiskAnalyzer]
    def initialize(settings: nil, devicegraph: nil, disk_analyzer: nil)
      super

      @initial_settings = self.settings
    end

    private

    # Initial settings
    #
    # The initial proposal could try with different settings over each candidate device.
    # This initial settings allows to restore the settings to its original version when
    # switching to a new candidate device.
    #
    # @return [ProposalSettings]
    attr_reader :initial_settings

    # @return [Proposal::SettingsGenerator]
    attr_reader :settings_generator

    # Tries to perform the initial proposal
    #
    # @see GuidedProposal#calculate_proposal
    #
    # The initial proposal will perform several attempts until a valid proposal is generated.
    # First, the proposal is tried over each individual candidate device. If a proposal was
    # not possible for any of the candidate devices, a last attempt is performed taking into
    # account all the candidate devices together.
    #
    # Moreover, several attempts are performed for each candidate device. First, a proposal
    # is calculated with the initial settings, and if it did not success, a new attempt is
    # tried with different settings. The new settings are a reduced version of the settings
    # used in the previous attempt. For example, the separate home or the snapshots can be
    # disabled for the new attempt.
    #
    # Finally, when the proposal is calculated with all the candidate devices together, several
    # attempts are performed considering each candidate device as possible root device.
    #
    # @raise [Error, NoDiskSpaceError] when the proposal cannot be calculated
    #
    # @return [true]
    def try_proposal
      try_with_each_candidate_group
    end

    # Tries to calculate a proposal for each group of candidate devices
    #
    # It stops once a valid proposal is calculated.
    #
    # @see #groups_of_candidate_devices
    #
    # @raise [Error, NoDiskSpaceError] when the proposal cannot be calculated
    #
    # @return [true]
    def try_with_each_candidate_group
      try_with_each(groups_of_candidate_devices) do |candidate_group|
        reset_settings
        settings.candidate_devices = candidate_group
        try_with_different_settings
      end
    end

    # Tries to calculate a proposal by using different settings for each attempt
    #
    # When a proposal is not possible, it tries a new attempt after disabling some
    # properties in the settings, for example, the separate home or the snaphots.
    #
    # It stops once a valid proposal is calculated.
    #
    # @raise [Error, NoDiskSpaceError] when the proposal cannot be calculated
    #
    # @return [true]
    def try_with_different_settings
      error = default_proposal_error

      @settings_generator = Proposal::SettingsGenerator.new(settings)

      loop do
        break unless assign_next_settings

        begin
          return try_with_different_root_devices
        rescue Error
          next
        end
      end

      raise error
    end

    # Tries to calculate a proposal by using different root devices
    #
    # When a proposal is not possible, it tries a new attempt after switching the root device.
    #
    # It stops once a valid proposal is calculated.
    #
    # @see #candidate_roots
    #
    # @raise [Error, NoDiskSpaceError] when the proposal cannot be calculated
    #
    # @return [true]
    def try_with_different_root_devices
      try_with_each(candidate_roots) do |root_device|
        settings.root_device = root_device
        try_with_each_permutation
      end
    end

    # Tries to calculate a proposal by using different allocations for every
    # volume within the candidates devices, given an already enforced root device
    #
    # When {#allocate_volume_mode} is set to :auto, this simply calls
    # {#try_with_each_target_size}, since the basic proposal in auto mode
    # already tries all the possible distribution of volumes within the
    # candidate devices.
    #
    # With :device mode, this makes an attempt for every combination of
    # devices and volumes. When a proposal is not possible, it tries again with
    # a different combination.
    #
    # It stops once a valid proposal is calculated.
    #
    # @see #devices_permutations
    #
    # @raise [Error, NoDiskSpaceError] when the proposal cannot be calculated
    #
    # @return [true]
    def try_with_each_permutation
      return try_with_each_target_size if settings.allocate_mode?(:auto)

      raise Y2Storage::Error if useless_permutations?

      try_with_each(devices_permutations) do |permutation|
        non_root_volumes_sets.each_with_index do |set, idx|
          set.device = permutation[idx]
        end

        try_with_each_target_size
      end
    end

    # Checks whether the current combination of root_device and candidate_devices has
    # any chance to produce at least one valid permutation for allocate_mode :device
    #
    # NOTE: This method is only intended to make a quick evaluation to early discard
    # sets of combinations. A false result doesn't imply there is actually a valid
    # permutation.
    #
    # @return [Boolean] true if it's clearly impossible to find a valid permutation
    def useless_permutations?
      # This method is only useful when allocate_mode is :device
      return false unless settings.allocate_mode?(:device)

      useless_candidate_devices? || useless_root_set?
    end

    # @see #useless_permutations?
    def useless_root_set?
      # There should always be a root_volumes_set, but better safe than sorry
      return false unless root_volumes_set

      root_device = candidate_objects.find { |d| d.name == root_volumes_set.device }
      return false if root_device.size > root_volumes_set.min_size

      log.info "The root volumes set does not fit into #{root_device.name}"
      true
    end

    # @see #useless_permutations?
    def useless_candidate_devices?
      devices = candidate_objects

      min = DiskSize.sum(proposed_volumes_sets.map(&:min_size))
      disks_size = DiskSize.sum(devices.map(&:size))
      # We use ">=" because the whole space of the disks can never be used to allocate
      # the volumes (the partition tables take space)
      if min >= disks_size
        log.info "The candidate devices are not big enough"
        return true
      end

      biggest = devices.map(&:size).max
      if proposed_volumes_sets.any? { |set| set.min_size > biggest }
        log.info "Some volumes sets are too big to fit into any of the candidate devices"
        return true
      end

      false
    end

    # Redefines this method from the base class to ensure the SpaceMaker object
    # and the clean devicegraph are recreated before trying
    def try_with_each_target_size
      @graph_generator = nil
      @clean_graph = nil
      super
    end

    # Resets the settings by assigning the initial settings
    def reset_settings
      self.settings = initial_settings
    end

    # Assigns the settings to use for the current proposal attempt
    #
    # It also saves the performed adjustments.
    #
    # @return [Boolean] true if the next settings can be generated; false otherwise.
    def assign_next_settings
      settings = settings_generator.next_settings
      return false if settings.nil?

      self.settings = settings
      self.auto_settings_adjustment = settings_generator.adjustments

      true
    end

    # Candidate devices grouped for different proposal attempts
    #
    # Different proposal attempts are performed by using different sets of candidate devices, which
    # will depend on the given settings:
    #
    # * single disk first (by default, no option needed): each candidate device is used individually
    # first and, if no proposal was possible with any individual disk, a last attempt is done by
    # using all available candidate devices.
    #
    # * multidisk first (multidisk_first => true): the proposal is tried using all available
    # candidate devices.
    #
    # NOTE: when multidisk first, it makes no sense to include also each candidate device as an
    # individual group at the end because if the proposal fails using all devices it also will fail
    # using them individually.
    #
    # @example
    #
    #  settings.multidisk_first #=> false
    #  settings.candidate_devices #=> ["/dev/sda", "/dev/sdb"]
    #  settings.groups_of_candidate_devices #=> [["/dev/sda"], ["/dev/sdb"], ["/dev/sda", "/dev/sdb"]]
    #
    #  settings.multidisk_first #=> true
    #  settings.candidate_devices #=> ["/dev/sda", "/dev/sdb"]
    #  settings.groups_of_candidate_devices #=> [["/dev/sda", "/dev/sdb"]]
    #
    # @return [Array<Array<String>>]
    def groups_of_candidate_devices
      candidates = candidate_devices

      return [candidates] if settings.multidisk_first

      candidates.zip.append(candidates).uniq
    end

    # Sorted list of disks to be tried as root device.
    #
    # In the theoretical case in which the current settings already specify a root_device (in practice,
    # the initial guided proposal never receives such settings), the list will contain only that device.
    #
    # Otherwise, it will contain all the candidate devices, sorted in the order they should be tried.
    #
    # @return [Array<String>]
    def candidate_roots
      return [settings.root_device] if settings.explicit_root_device

      # We use #explicit_candidate_devices because it contains all the devices of the candidate_group.
      # That's not always true for #candidate_devices. If there are fewer proposed_volumes_sets than
      # devices in the group, using #candidate_devices could result in giving up before trying all the
      # possibilities.
      disk_names = settings.explicit_candidate_devices
      disk_names.select { |n| initial_devicegraph.find_by_name(n) }
    end

    # All possible combinations of candidate devices to assign to the non-root
    # volume sets
    #
    # Every entry of the array contains an array of device names in the order in
    # which they must be assigned to the non-root volume sets of the settings
    #
    # @return [Array<Array<String>>]
    def devices_permutations
      disk_names = settings.explicit_candidate_devices
      size = non_root_volumes_sets.size

      # #repeated_permutation does not guarantee stable sorting, so let's enforce it
      disk_names.repeated_permutation(size).sort do |p1, p2|
        dev1 = devices_used_by_permutation(p1)
        dev2 = devices_used_by_permutation(p2)

        # Try first the combinations that expands over more devices, so the behavior
        # is more similar to mode :auto.
        if dev1.size == dev2.size
          # For equally big combinations, let's simply use any arbitrary stable sorting
          dev1.join <=> dev2.join
        else
          dev2.size <=> dev1.size
        end
      end
    end

    # Names of the devices that will tentatively be used by the proposal if a
    # given permutation is used in {#try_with_each_permutation}
    #
    # @param non_root_list [Array<String>] devices to use for the non-root
    #   volumes sets
    # @return [Array<String>]
    def devices_used_by_permutation(non_root_list)
      ([settings.root_device] + non_root_list).uniq
    end

    # All proposed volumes sets from the settings except the one containing the
    # root volume
    #
    # @return [Array<VolumeSpecificationsSet>]
    def non_root_volumes_sets
      proposed_volumes_sets.reject(&:root?)
    end

    # Volumes set containing the root volume
    #
    # @return [VolumeSpecificationSet, nil]
    def root_volumes_set
      proposed_volumes_sets.find(&:root?)
    end
  end
end
