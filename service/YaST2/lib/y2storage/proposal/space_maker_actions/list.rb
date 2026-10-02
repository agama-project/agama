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

require "y2storage/proposal/space_maker_actions/auto_strategy"
require "y2storage/proposal/space_maker_actions/bigger_resize_strategy"

module Y2Storage
  module Proposal
    module SpaceMakerActions
      # A set of actions to be executed by SpaceMaker
      #
      # This class is responsible of selecting which prospect action would be the next to be
      # performed by SpaceMaker, both at the beginning of the process (mandatory actions) and during
      # the iterative process done to find enough space (optional actions).
      class List
        # Initialize.
        #
        # @param settings [ProposalSpaceSettings] proposal settings
        # @param disk_analyzer [DiskAnalyzer] information about existing partitions
        def initialize(settings, disk_analyzer)
          klass = strategy?(:bigger_resize, settings) ? BiggerResizeStrategy : AutoStrategy
          @strategy = klass.new(settings, disk_analyzer)
        end

        # Adds mandatory actions to be performed at the beginning of the process
        #
        # @see SpaceMaker#prepare_devicegraph
        #
        # @param disk [Disk] disk to act upon
        def add_mandatory_actions(disk)
          strategy.add_mandatory_actions(disk)
        end

        # Adds optional actions to be performed if needed until the goal is reached
        #
        # @see SpaceMaker#provide_space
        #
        # @param disk [Disk] disk to act upon
        # @param volume_group [Planned::LvmVg, nil] system LVM VG to be created or reused, if any
        def add_optional_actions(disk, volume_group)
          strategy.add_optional_actions(disk, volume_group)
        end

        # Next action to be performed by SpaceMaker
        #
        # @return [Action, nil] nil if there are no more actions in the list
        def next
          strategy.next
        end

        # Marks the action currently reported by {#next} as completed, so it will not be longer
        # returned by subsequent calls to {#next}
        #
        # @param deleted_sids [Array<Integer>] sids of devices that are not longer available as
        #   a side effect of completing the action
        def done(deleted_sids = [])
          strategy.done(deleted_sids)
        end

        private

        # @return [AutoStrategy, BiggerResizeStrategy]
        attr_reader :strategy

        def strategy?(name, settings)
          settings.strategy.to_sym == name.to_sym
        end
      end
    end
  end
end
