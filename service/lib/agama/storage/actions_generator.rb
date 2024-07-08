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

require "agama/storage/action"

module Agama
  module Storage
    # Generates the list of actions to perform over the storage devices.
    class ActionsGenerator
      # param system_graph [Y2Storage::Devicegraph]
      # param target_graph [Y2Storage::Devicegraph]
      def initialize(system_graph, target_graph)
        @system_graph = system_graph

        # Keep a reference to the actiongraph. Otherwise, accessing to the compound actions could
        # raise a segmentation fault if the actiongraph object was killed by the ruby GC.
        #
        # Source of the problem:
        #   * An actiongraph is generated from the target devicegraph.
        #   * The list of compound actions is recovered from the actiongraph.
        #   * If there is no refrence to the actiongraph, then the actiongraph object is a candidate
        #     to be cleaned by the ruby GC.
        #   * Accessing to the generated compound actions raises a segmentation fault if the
        #     actiongraph was cleaned.
        #
        # See https://github.com/openSUSE/agama/issues/1396.
        @actiongraph = target_graph.actiongraph
      end

      # All actions properly sorted.
      #
      # @return [Array<Action>]
      def generate
        main_actions + subvolume_actions
      end

    private

      # @return [Y2Storage::Devicegraph]
      attr_reader :system_graph

      # @return [Y2Storage::Actiongraph]
      attr_reader :actiongraph

      # Sorted main actions (everything except subvolume actions).
      #
      # @return [Array<Action>]
      def main_actions
        actions = self.actions.reject(&:on_btrfs_subvolume?)
        sort_actions(actions)
      end

      # Sorted subvolume actions.
      #
      # @return [Array<Action>]
      def subvolume_actions
        actions = self.actions.select(&:on_btrfs_subvolume?)
        sort_actions(actions)
      end

      # All actions, without sorting.
      #
      # @return [Array<Action>]
      def actions
        @actions ||= actiongraph.compound_actions.map do |action|
          Action.new(action, system_graph)
        end
      end

      # Sorts actions, placing destructive actions at the end.
      #
      # @param actions [Array<Action>]
      # @return [Array<Action>]
      def sort_actions(actions)
        delete, other = actions.partition(&:delete?)
        delete.concat(other)
      end
    end
  end
end
