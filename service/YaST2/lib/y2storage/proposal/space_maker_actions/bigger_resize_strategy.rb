# Copyright (c) [2023-2024] SUSE LLC
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

require "y2storage/proposal/space_maker_actions/shrink"
require "y2storage/proposal/space_maker_actions/delete"
require "y2storage/proposal/space_maker_actions/wipe"

module Y2Storage
  module Proposal
    module SpaceMakerActions
      # Strategy for {SpaceMakerActions::List} used for the case in which the actions to perform are
      # explicitly configured as part of the proposal settings.
      class BiggerResizeStrategy
        # Constructor
        #
        # @param settings [ProposalSpaceSettings] proposal settings
        def initialize(settings, _disk_analyzer)
          @settings = settings
          @to_delete_mandatory = []
          @to_delete_optional = []
          @to_wipe = []
          @to_shrink_mandatory = []
          @to_shrink_optional = []
        end

        # @param disk [Disk] see {List}
        def add_mandatory_actions(disk)
          return unless disk.partition_table?

          add_mandatory_delete(disk)
          add_mandatory_shrink(disk)
        end

        # @param disk [Disk] see {List}
        def add_optional_actions(disk, _lvm_helper)
          add_wipe(disk)
          add_optional_shrink(disk)
          add_optional_delete(disk)
        end

        # @return [Action, nil] nil if there are no more actions in the list
        def next
          source = source_for_next
          send(source).first
        end

        # @param deleted_sids [Array<Integer>] see {List}
        def done(deleted_sids)
          send(source_for_next).shift
          cleanup(to_delete_mandatory, deleted_sids)
          cleanup(to_delete_optional, deleted_sids)
          cleanup(to_shrink_mandatory, deleted_sids)
          cleanup(to_shrink_optional, deleted_sids)
        end

        private

        # @return [ProposalSpaceSettings] proposal settings for making space
        attr_reader :settings

        # @return [Array<Base>] list of mandatory delete actions
        attr_reader :to_delete_mandatory

        # @return [Array<Base>] list of optional delete actions
        attr_reader :to_delete_optional

        # @return [Array<Base>] list of mandatory shrink actions
        attr_reader :to_shrink_mandatory

        # @return [Array<Base>] list of optional shrink actions
        attr_reader :to_shrink_optional

        # @return [Array<Base>] list of actions to wipe disks if needed
        attr_reader :to_wipe

        # @see #add_optional_actions
        # @param disk [Disk]
        def add_wipe(disk)
          return if disk.partition_table?

          to_wipe << Wipe.new(disk)
        end

        # @see #add_optional_actions
        # @param disk [Disk]
        def add_optional_shrink(disk)
          return unless disk.partition_table?

          actions = optional_shrinks(disk)
          return if actions.empty?

          @to_shrink_optional = (to_shrink_optional + actions).sort do |a, b|
            preferred_resize(a, b, disk.devicegraph)
          end
        end

        # @see #add_optional_shrink
        # @param disk [Disk]
        def optional_shrinks(disk)
          partitions(disk).map do |part|
            resize = resize_actions.find { |a| a.device == part.name }
            next unless resize
            next if resize.min_size && resize.min_size > part.size
            next if resize.max_size && resize.max_size < part.size

            resize_to_shrink(part, resize)
          end.compact
        end

        # Compares two shrinking operations to decide which one should be executed first
        #
        # @param resize1 [Shrink]
        # @param resize2 [Shrink]
        def preferred_resize(resize1, resize2, devicegraph)
          part1 = devicegraph.find_device(resize1.sid)
          part2 = devicegraph.find_device(resize2.sid)
          result = recoverable_size(part2, resize2) <=> recoverable_size(part1, resize1)
          return result unless result.zero?

          # Just to ensure stable sorting between different executions in case of draw
          part1.name <=> part2.name
        end

        # Max space that can be recovered from the given partition, having into account the
        # restrictions imposed by the its Resize action
        #
        # @see #preferred_resize
        def recoverable_size(partition, resize)
          min = resize.min_size
          return partition.recoverable_size if min.nil? || min > partition.size

          [partition.recoverable_size, partition.size - min].min
        end

        # @see #add_optional_actions
        #
        # @param disk [Disk]
        def add_optional_delete(disk)
          return unless disk.partition_table?

          partitions = partitions(disk).select { |p| configured?(p, :delete) }
          partitions.sort! { |a, b| preferred_delete(a, b) }
          actions = partitions.map { |p| Delete.new(p, related_partitions: false) }
          to_delete_optional.concat(actions)
        end

        # Compares two partitions to decide which one should be deleted first
        #
        # @param part1 [Partition]
        # @param part2 [Partition]
        def preferred_delete(part1, part2)
          # FIXME: Currently this mimics the order from the auto strategy.
          # We might consider other approaches in the future, like deleting partitions that are
          # next to another partition that needs to grow. That circumstance is maybe not so easy
          # to evaluate at the start and needs to be reconsidered after every action.
          part2.region.start <=> part1.region.start
        end

        # @see #add_optional_actions
        # @param disk [Disk]
        def add_mandatory_shrink(disk)
          shrink_actions = partitions(disk).map do |part|
            resize = resize_actions.find { |a| a.device == part.name }
            next unless resize
            next unless resize.max_size
            next if part.size <= resize.max_size

            resize_to_shrink(part, resize)
          end.compact

          to_shrink_mandatory.concat(shrink_actions)
        end

        # @see #add_mandatory_actions
        # @param disk [Disk]
        def add_mandatory_delete(disk)
          devices = partitions(disk).select { |p| configured?(p, :force_delete) }
          actions = devices.map { |d| Delete.new(d, related_partitions: false) }
          to_delete_mandatory.concat(actions)
        end

        # Whether the given action is configured for the given device at the proposal settings
        #
        # @see ProposalSpaceSettings#actions
        #
        # @param device [BlkDevice]
        # @param action [Symbol] :force_delete, :delete or :resize
        # @return [Boolean]
        def configured?(device, action)
          case action
          when :force_delete
            delete_actions.select(&:mandatory).any? { |a| a.device == device.name }
          when :delete
            delete_actions.reject(&:mandatory).any? { |a| a.device == device.name }
          end
        end

        # Removes devices with the given sids from a collection
        #
        # @param collection [Array<Action>]
        # @param deleted_sids [Array<Integer>]
        def cleanup(collection, deleted_sids)
          collection.delete_if { |d| deleted_sids.include?(d.sid) }
        end

        # Collection for the next action
        #
        # @return [Symbol]
        def source_for_next
          if to_delete_mandatory.any?
            :to_delete_mandatory
          elsif to_wipe.any?
            :to_wipe
          elsif to_shrink_mandatory.any?
            :to_shrink_mandatory
          elsif to_shrink_optional.any?
            :to_shrink_optional
          else
            :to_delete_optional
          end
        end

        # Relevant partitions for the given disk
        def partitions(disk)
          disk.partitions.reject { |part| part.type.is?(:extended) }
        end

        # Trivial conversion
        def resize_to_shrink(partition, resize)
          Shrink.new(partition).tap do |shrink|
            shrink.min_size = resize.min_size
            shrink.max_size = resize.max_size
          end
        end

        # All delete actions from the settings
        def delete_actions
          settings.delete_actions
        end

        # All resize actions from the settings
        def resize_actions
          settings.resize_actions
        end
      end
    end
  end
end
