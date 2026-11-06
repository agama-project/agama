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

require "y2storage/storage_class_wrapper"

module Y2Storage
  # Container of the actions that must be performed in one devicegraph to make
  # it equivalent to another one.
  #
  # This is a wrapper for Storage::Devicegraph
  class Actiongraph
    include StorageClassWrapper
    wrap_class Storage::Actiongraph

    # @!method empty?
    #   Checks whether the actiongraph is empty (no actions)
    storage_forward :empty?

    # @!method print_graph
    #   Prints a textual representation of the graph through stdout
    storage_forward :print_graph

    # @!method write_graphviz(filename, graphviz_flags)
    #   Writes the devicegraph to a file in Graphviz format
    storage_forward :write_graphviz

    # @!method commit_actions_as_strings
    #   @return [Array<String>] Action descriptions sorted according to
    #     dependencies among actions
    storage_forward :commit_actions_as_strings

    storage_forward :storage_compound_actions, to: :compound_actions, as: "CompoundAction"
    private :storage_compound_actions

    # @!method storage_used_features
    #   @return [Integer] bit-field with the used features of the actiongraph
    storage_forward :storage_used_features, to: :used_features
    private :storage_used_features

    # List of compound actions of the actiongraph.
    #
    # @note This is different from ::Storage#compound_actions because this
    #   method makes sure the actions are already calculated, so there is no
    #   need to trigger the generation of the compound actions manually.
    #
    # @see CompoundAction
    #
    # @return [Array<CompoundAction>]
    def compound_actions
      to_storage_value.generate_compound_actions unless generated_compound_actions?
      storage_compound_actions
    end

    # List of storage features used by the actiongraph
    #
    # @return [StorageFeaturesList]
    def used_features
      StorageFeaturesList.from_bitfield(storage_used_features)
    end

    private

    # Checks whether the compound actions have already been generated for this
    # actiongraph and, thus, whether #storage_compound_actions contains
    # meaningul information
    def generated_compound_actions?
      return false if storage_compound_actions.empty? && !empty?

      true
    end
  end
end
