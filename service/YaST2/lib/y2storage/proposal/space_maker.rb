# Copyright (c) [2015-2024] SUSE LLC
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

require "fileutils"
require "storage"
require "y2storage/partitionable"
require "y2storage/disk_size"
require "y2storage/free_disk_space"
require "y2storage/proposal/partitions_distribution_calculator"
require "y2storage/proposal/space_maker_actions"

module Y2Storage
  module Proposal
    # Class to provide free space for creating new partitions - either by
    # reusing existing unpartitioned space, by deleting existing partitions
    # or by resizing an existing Windows partition.
    class SpaceMaker
      include Yast::Logger

      attr_accessor :settings
      attr_reader :original_graph

      # Sids of devices that should not be affected by SpaceMaker changes
      #
      # The devices should not be deleted or resized either directly (in the case of partitions)
      # or indirectly. For example, if the sid corresponds to an LVM LV, none of the partitions
      # that act as PV of the same volume group should be deleted or resized.
      #
      # @return [Array<Integer>]
      attr_accessor :protected_sids

      # Initialize.
      #
      # @param disk_analyzer [DiskAnalyzer] information about existing partitions
      # @param settings [ProposalSpaceSettings] space settings
      def initialize(disk_analyzer, settings)
        @disk_analyzer = disk_analyzer
        @settings = settings
        @all_deleted_sids = []
        @protected_sids = []
      end

      # Performs all the operations needed to free enough space to accomodate
      # a set of planned partitions and the new physical volumes needed to
      # accomodate the planned LVM logical volumes.
      #
      # @raise [Error] if is not possible to accomodate the planned
      #   partitions and/or the physical volumes
      #
      # @param original_graph [Devicegraph] initial devicegraph
      # @param partitions [Array<Planned::Partition>] set of partitions to make space for
      # @param volume_groups [Planned::LvmVg] set of LVM volume groups for which is necessary to
      #   allocate auto-calculated physical volumes
      # @param default_disks [Array<Strings>] disks that will be used to allocate those partitions
      #   with no concrete disks and the physical volumes for those volume groups with no concrete
      #   candidate devices
      # @return [Hash] a hash with three elements:
      #   devicegraph: [Devicegraph] resulting devicegraph
      #   deleted_partitions: [Array<Partition>] partitions that
      #     were in the original devicegraph but are not in the resulting one
      #   partitions_distribution: [Planned::PartitionsDistribution] proposed
      #     distribution of partitions, including new PVs if necessary
      #
      def provide_space(original_graph, partitions: [], volume_groups: [], default_disks: [])
        @original_graph = original_graph

        calculate_new_graph(partitions, volume_groups, default_disks)

        {
          devicegraph:             new_graph,
          deleted_partitions:      deleted_partitions,
          partitions_distribution: @distribution
        }
      end

      # Executes all the mandatory actions to make space (see #{SpaceMakerActions::List})
      #
      # @param original_graph [Devicegraph] initial devicegraph
      # @param disks [Array<Strings>] set of disk names to operate on
      # @return [Devicegraph] copy of #original_graph after performing the actions
      def prepare_devicegraph(original_graph, disks)
        log.info "BEGIN SpaceMaker#prepare_devicegraph"

        result = original_graph.dup
        actions = SpaceMakerActions::List.new(settings, disk_analyzer)
        @all_disk_names = disks

        disks.each do |disk_name|
          disk = result.find_by_name(disk_name)
          next unless disk

          actions.add_mandatory_actions(disk)
        end
        skip = all_protected_sids(result)

        while (action = actions.next)
          sids = execute_action(action, result, skip)
          actions.done(sids)
          @all_deleted_sids.concat(sids)
        end

        log.info "END SpaceMaker#prepare_devicegraph"
        result
      end

      protected

      attr_reader :disk_analyzer

      # New devicegraph calculated by {#provide_space}
      # @return [Devicegraph]
      attr_reader :new_graph

      # Sids of the partitions deleted while calculating {#new_graph}. In other
      # words, partitions that where in the original devicegraph passed to
      # {#provide_space} but that are not longer there in {#new_graph}.
      #
      # @return [Array<Integer>]
      attr_reader :new_graph_deleted_sids

      # @see #provide_space
      #
      # @return [Array<String>]
      attr_reader :default_disk_names

      # Names of all the disks that are involved in the current operation (ie. current call
      # to {#prepare_devicegraph} or to {#provide_space})
      #
      # @return [Array<String>]
      attr_reader :all_disk_names

      # Auxiliary variable kept because some space strategies need to know whether some volume
      # group is being reused (and which one).
      #
      # FIXME: keeping this internal variable is probably avoidable since it's used for a very
      # concrete purpose
      #
      # @return [Array<Planned::LvmVg>]
      attr_reader :all_volume_groups

      # Partitions from the original devicegraph that are not present in the
      # result of the last call to #provide_space
      #
      # @return [Array<Partition>]
      def deleted_partitions
        original_graph.partitions.select { |p| @all_deleted_sids.include?(p.sid) }
      end

      # @see #provide_space
      #
      # @param partitions [Array<Planned::Partition>] partitions to make space for
      # @param volume_groups [Array<Planned::LvmVg>] volume groups to potentially create PVs for
      # @param default_disk_names [Array<Strings>] disks that will be used to allocate partitions
      #   with no disk and volume groups with no candidate devices
      def calculate_new_graph(partitions, volume_groups, default_disk_names)
        @new_graph = original_graph.duplicate
        @new_graph_deleted_sids = []

        @all_volume_groups = volume_groups
        @default_disk_names = default_disk_names
        @all_disk_names = all_disks(partitions, volume_groups, default_disk_names)

        # To make sure we are not freeing space in useless places first restrict the operations to
        # disks with particular requirements (they are the only option for some partitions or VGs)
        #
        # planned_devices_by_disk() returns all partitions and VGs restricted to a certain disk
        #
        # Doing something similar for #max_start_offset is more difficult and doesn't pay off
        # (#max_start_offset is used just in one case)

        devs_by_disk = planned_devices_by_disk(partitions, volume_groups)

        # In some cases (for example, if there is only one candidate disk), executing
        # #resize_and_delete with a particular disk name and its restricted set of planned devices
        # brings no value. It just makes the whole thing harder to debug (bsc#1057436).
        if several_passes?(devs_by_disk)
          # Start by freeing space to the planned devices that are restricted to a certain disk.
          devs_by_disk.each do |disk, devs|
            parts, vgs = devs.partition { |d| d.is_a?(Planned::Partition) }
            dist_calculator = dist_calculator_for(parts, volume_groups, disk)
            resize_and_delete(dist_calculator, disk_name: disk)
          rescue Error
            # The previously used dist_calculator tried to allocate the specific partitions for
            # this disk but also all new physical volumes for any LVM which could use the disk.
            # So a failure may not mean all hope is lost.
            #
            # Let's check if we can still find a distribution if we stick to the volume groups that
            # are fully attached to this disk (ie. can use no other disk)
            raise unless disk_still_fits?(dist_calculator, parts, vgs)
          end
        end

        # Now repeat the process with the full set of planned devices and disks
        dist_calculator = dist_calculator_for(partitions, volume_groups)
        resize_and_delete(dist_calculator)

        @all_deleted_sids.concat(new_graph_deleted_sids)
      end

      # @see #calculate_new_graph
      #
      # @return [Boolean]
      def disk_still_fits?(previous_dist_calculator, disk_partitions, disk_vgs)
        # The previous failed attempt was already the best for this disk
        return false if previous_dist_calculator.planned_vgs == disk_vgs

        # Let's make a new attempt restricting the volume groups
        dist_calculator = dist_calculator_for(disk_partitions, disk_vgs)
        success?(dist_calculator)
      end

      # @see #calculate_new_graph
      #
      # @return [Array<String>]
      def all_disks(partitions, volume_groups, default_disks)
        lvm_disks = volume_groups.flat_map(&:pvs_candidate_devices).uniq
        partition_disks = partitions.map(&:disk).compact.uniq
        (lvm_disks + partition_disks + default_disks).sort.uniq
      end

      # @return [Hash{String => Array<Planned::Partition, Planned::LvmVg>}]
      def planned_devices_by_disk(planned_partitions, volume_groups)
        result = planned_partitions.each_with_object({}) do |partition, hash|
          if partition.disk
            hash[partition.disk] ||= []
            hash[partition.disk] << partition
          end
        end
        volume_groups.each_with_object(result) do |vg, hash|
          if vg.forced_disk_name
            hash[vg.forced_disk_name] ||= []
            hash[vg.forced_disk_name] << vg
          end
        end
      end

      # Instantiates a PartitionsDistributionCalculator for the given set of planned devices
      #
      # @return [PartitionsDistributionCalculator]
      def dist_calculator_for(partitions, volume_groups, disk_name = nil)
        vgs = disk_name ? volume_groups_for(disk_name, volume_groups) : volume_groups
        PartitionsDistributionCalculator.new(partitions, vgs, default_disk_names)
      end

      # @see #dist_calculator_for
      def volume_groups_for(disk, volume_groups)
        volume_groups.select { |vg| disks_for_vg(vg).any?(disk) }
      end

      # @see #volume_groups_for
      def disks_for_vg(vg)
        return default_disk_names if vg.pvs_candidate_devices.empty?

        vg.pvs_candidate_devices
      end

      # Checks whether the goal has already being reached
      #
      # If it returns true, it stores in @distribution the PartitionsDistribution
      # that made it possible.
      #
      # @return [Boolean]
      def success?(dist_calculator)
        @distribution ||= dist_calculator.best_distribution(free_spaces)
        !!@distribution
      rescue Error => e
        log.info "Exception while trying to distribute partitions: #{e}"
        @distribution = nil
        false
      end

      # Performs all the needed operations to make space for the partitions, including physical
      # volumes
      #
      # @param dist_calculator [PartitionsDistributionCalculator]
      # @param disk_name [String, nil] optional disk name to restrict operations to
      def resize_and_delete(dist_calculator, disk_name: nil)
        # Note that only the execution with disk_name == nil is the final one.
        # In other words, if disk_name contains something, it means there will be at least a
        # subsequent call to the method if everything goes right and the process is not aborted

        log_resize_and_delete(dist_calculator, disk_name)
        # restart evaluation
        @distribution = nil
        force_ptables(dist_calculator.planned_partitions)

        actions = SpaceMakerActions::List.new(settings, disk_analyzer)

        disks_for(new_graph, disk_name).each do |disk|
          actions.add_optional_actions(disk, all_volume_groups)
        end
        skip = all_protected_sids(new_graph)

        # rubocop:disable Style/WhileUntilModifier
        # Moving the until at the end makes the 'break' hard to understand
        until success?(dist_calculator)
          break unless execute_next_action(actions, skip, dist_calculator)
        end
        # rubocop:enable Style/WhileUntilModifier

        raise Error unless @distribution
      end

      # @see #resize_and_delete
      def log_resize_and_delete(dist_calculator, disk_name)
        log.info "Resize and delete. disk_name: #{disk_name}, planned_devices:"
        dist_calculator.planned_partitions.each do |p|
          log.info "  mount: #{p.mount_point}, disk: #{p.disk}, min: #{p.min}, max: #{p.max}"
        end
        dist_calculator.planned_vgs.each do |vg|
          log.info "  vg_name: #{vg.volume_group_name}, disks: #{vg.pvs_candidate_devices}"
        end
      end

      def force_ptables(planned_partitions)
        forced = planned_partitions.select { |part| part.disk && part.ptable_type }
        forced.each do |part|
          disk = new_graph.find_by_name(part.disk)
          disk.forced_ptable_type = part.ptable_type
        end
      end

      # Identifiers of all the devices that should be kept as-is, either because their are
      # part of #protected_sids or because they would affect them indirectly
      #
      # @param devicegraph [Devicegraph] graph used to calculate the relationship between sids
      # @return [Array<Integer>]
      def all_protected_sids(devicegraph)
        devices = protected_sids.map { |s| devicegraph.find_device(s) }.compact
        all_devices = devices + devices.flat_map(&:ancestors)
        all_devices.map(&:sid)
      end

      # Performs the next action of {#resize_and_delete}
      #
      # @param actions [SpaceMakerActions::List] set of actions that could be executed
      # @param skip [Array<Integer>] sids of devices that should not be modified
      # @param dist_calculator [PartitionsDistributionCalculator]
      # @return [Boolean] true if some operation was performed. False if nothing
      #   else could be done to reach the goal.
      def execute_next_action(actions, skip, dist_calculator)
        action = actions.next
        if !action
          log.info "No more actions for this SpaceMaker iteration"
          return false
        end

        sids = execute_action(action, new_graph, skip, dist_calculator)
        actions.done(sids)
        new_graph_deleted_sids.concat(sids)
        true
      end

      # Executes the given SpaceMaker action
      #
      # @param action [SpaceMakerActions::Base] action to execute
      # @param graph [Devicegraph] devicegraph in which the action will be executed
      # @param skip [Array<Integer>] sids of devices that should not be modified
      # @param dist_calculator [PartitionsDistributionCalculator]
      # @return [Array<Integer>] sids of the devices that has been deleted as a consequence
      #   of the action
      def execute_action(action, graph, skip, dist_calculator = nil)
        if skip.include?(action.sid)
          log.info "Skipping action on device #{action.sid} (#{action.class})"
          return []
        end

        case action
        when SpaceMakerActions::Shrink
          execute_shrink(action, graph, dist_calculator)
        when SpaceMakerActions::Delete
          execute_delete(action, graph)
        else
          execute_wipe(action, graph)
        end
      end

      # Performs the action described by a {SpaceMakerActions::Shrink}
      #
      # @see #execute_action
      #
      # @param action [ProposalSpaceAction]
      # @param devicegraph [Devicegraph]
      # @param dist_calculator [PartitionsDistributionCalculator]
      # @return [Array<Integer>]
      def execute_shrink(action, devicegraph, dist_calculator)
        log.info "SpaceMaker#execute_shrink - #{action}"

        if action.target_size.nil?
          part = devicegraph.find_device(action.sid)
          if dist_calculator
            resizing = resizing_size(part, dist_calculator)
            action.target_size = resizing > part.size ? DiskSize.zero : part.size - resizing
          else
            # Mandatory resize
            action.target_size = part.size
          end
        end

        action.shrink(devicegraph)
      end

      # Performs the action described by a {SpaceMakerActions::Delete}
      #
      # @see #execute_action
      #
      # @param action [ProposalSpaceAction]
      # @param devicegraph [Devicegraph]
      # @return [Array<Integer>]
      def execute_delete(action, devicegraph)
        log.info "SpaceMaker#execute_delete - #{action}"
        action.delete(devicegraph, all_disk_names)
      end

      # Performs the action described by a {SpaceMakerActions::Wipe}
      #
      # @see #execute_action
      #
      # @param action [ProposalSpaceAction]
      # @param devicegraph [Devicegraph]
      # @return [Array<Integer>]
      def execute_wipe(action, devicegraph)
        log.info "SpaceMaker#execute_wipe - #{action}"
        action.wipe(devicegraph)
      end

      # Additional space that needs to be freed while resizing a partition in
      # order to reach the goal
      #
      # @return [DiskSize]
      def resizing_size(partition, dist_calculator)
        dist_calculator.resizing_size(partition, free_spaces)
      end

      # List of free spaces from all the involved devices in the new devicegraph
      #
      # @return [Array<FreeDiskSpace>]
      def free_spaces
        disks_for(new_graph).each_with_object([]) do |d, list|
          list.concat(d.as_not_empty { d.free_spaces })
        end
      end

      # List of candidate disk devices in the given devicegraph
      #
      # @param devicegraph [Devicegraph]
      # @param device_name [String, nil] optional device name to restrict result to
      #
      # @return [Array<Dasd, Disk>]
      def disks_for(devicegraph, device_name = nil)
        filter = device_name ? [device_name] : all_disk_names
        devicegraph.blk_devices.select { |d| filter.include?(d.name) }
      end

      # Whether {#resize_and_delete} should be executed several times,
      # see {#calculate_new_graph} for details.
      #
      # @param devs_by_disk [Hash{String => Array<Planned::Device>}] see
      #   {#planned_devices_by_disk}
      # @return [Boolean]
      def several_passes?(devs_by_disk)
        # In this case the result is not much relevant since #resize_and_delete
        # wouldn't be executed for particular disks anyway
        return false if devs_by_disk.empty?

        return true if devs_by_disk.size > 1

        # Note that, at this point, we already know devs_by_disk.keys contains just one element
        devs_by_disk.keys != all_disk_names
      end
    end
  end
end
