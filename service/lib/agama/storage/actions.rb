# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

require "y2storage/storage_manager"

module Agama
  module Storage
    # Backend class to get the list of actions over the storage devices
    class Actions
      # @param logger [Logger]
      # param actiongraph [Y2Storage::Actiongraph]
      def initialize(logger, actiongraph)
        @logger = logger
        @actiongraph = actiongraph
      end

      # All actions properly sorted
      #
      # @return [Array<Y2Storage::CompoundAction>]
      def all
        main_actions + subvolume_actions
      end

    private

      # @return [Logger]
      attr_reader :logger

      # @return [Y2Storage::Actiongraph]
      attr_reader :actiongraph

      # Sorted main actions (everything except subvolume actions)
      #
      # @return [Array<Y2Storage::CompoundAction>]
      def main_actions
        actions = self.actions.reject { |a| subvol_action?(a) }
        sort_actions(actions)
      end

      # Sorted subvolume actions
      #
      # @return [Array<Y2Storage::CompoundAction>]
      def subvolume_actions
        actions = self.actions.select { |a| subvol_action?(a) }
        sort_actions(actions)
      end

      # All actions, without sorting
      #
      # @return [Array<Y2Storage::CompoundAction>]
      def actions
        actiongraph.compound_actions
      end

      # Sorts actions, placing destructive actions at the end
      #
      # @param actions [Array<Y2Storage::CompoundAction>]
      # @return [Array<Y2Storage::CompoundAction>]
      def sort_actions(actions)
        delete, other = actions.partition(&:delete?)
        delete.concat(other)
      end

      # Whether the action acts over a Btrfs subvolume
      #
      # @param action [Y2Storage::CompoundAction]
      # @return [Boolean]
      def subvol_action?(action)
        action.device_is?(:btrfs_subvolume)
      end
    end
  end
end
