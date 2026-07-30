# frozen_string_literal: true

# Copyright (c) [2024-2026] SUSE LLC
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

require "agama/storage/config_conversions/to_json_conversions/base"
require "agama/storage/configs/search_conditions"
require "agama/storage/configs/sort_criteria"

module Agama
  module Storage
    module ConfigConversions
      module ToJSONConversions
        # Search conversion to JSON hash according to schema.
        class Search < Base
          # @param config [Configs::Search]
          def initialize(config)
            super()
            @config = config
          end

        private

          # @see Base#conversions
          def conversions
            {
              condition:  convert_condition,
              sort:       convert_sort,
              ifNotFound: config.if_not_found.to_s,
              max:        config.max
            }
          end

          # Uses the found device's name when the search is solved with a device;
          # otherwise serializes the condition tree.
          #
          # @return [Hash, nil]
          def convert_condition
            return { name: config.device.name } if config.device

            convert_condition_node(config.condition)
          end

          # Recursively serializes a condition node.
          #
          # @param node [Configs::SearchConditions::*, nil]
          # @return [Hash, nil]
          def convert_condition_node(node)
            convert_leaf_node(node) || convert_operator_node(node)
          end

          # Serializes a leaf condition node.
          #
          # @param node [Configs::SearchConditions::*, nil]
          # @return [Hash, nil]
          def convert_leaf_node(node)
            convert_common_leaf(node) ||
              convert_drive_leaf(node) ||
              convert_partition_leaf(node) ||
              convert_filesystem_leaf(node) ||
              convert_partitions_leaf(node)
          end

          # Serializes a leaf condition accepted by any kind of device.
          #
          # @param node [Configs::SearchConditions::*, nil]
          # @return [Hash, nil]
          def convert_common_leaf(node)
            case node
            when Configs::SearchConditions::Name
              { name: node.name }
            when Configs::SearchConditions::Size
              { size: { node.operator => node.value.to_i } }
            end
          end

          # Serializes a leaf condition only accepted by drives.
          #
          # @param node [Configs::SearchConditions::*, nil]
          # @return [Hash, nil]
          def convert_drive_leaf(node)
            case node
            when Configs::SearchConditions::Driver
              { driver: node.driver }
            when Configs::SearchConditions::Transport
              { transport: node.transport.to_s }
            end
          end

          # Serializes a leaf condition only accepted by partitions.
          #
          # @param node [Configs::SearchConditions::*, nil]
          # @return [Hash, nil]
          def convert_partition_leaf(node)
            case node
            when Configs::SearchConditions::PartitionNumber
              { number: node.number }
            when Configs::SearchConditions::PartitionId
              { id: node.id.to_s }
            end
          end

          # @param node [Configs::SearchConditions::*, nil]
          # @return [Hash, nil]
          def convert_filesystem_leaf(node)
            case node
            when Configs::SearchConditions::Filesystem
              { filesystem: convert_filesystem_value(node) }
            when Configs::SearchConditions::FilesystemType
              { type: node.fs_type.to_s }
            when Configs::SearchConditions::FilesystemLabel
              { label: node.label }
            end
          end

          # @param node [Configs::SearchConditions::*, nil]
          # @return [Hash, nil]
          def convert_partitions_leaf(node)
            return unless node.is_a?(Configs::SearchConditions::Partitions)

            { partitions: convert_partitions_value(node) }
          end

          # Serializes an operator condition node.
          #
          # @param node [Configs::SearchConditions::*, nil]
          # @return [Hash, nil]
          def convert_operator_node(node)
            case node
            when Configs::SearchConditions::And
              { and: convert_conditions(node.conditions) }
            when Configs::SearchConditions::Or
              { or: convert_conditions(node.conditions) }
            when Configs::SearchConditions::Not
              { not: convert_condition_node(node.condition) }
            end
          end

          # Serializes the value of a Filesystem condition: the presence shortcut
          # ("any"/"none") or the nested filesystem condition object.
          #
          # @param node [Configs::SearchConditions::Filesystem]
          # @return [String, Hash, nil]
          def convert_filesystem_value(node)
            return convert_condition_node(node.condition) if node.condition

            node.presence&.to_s
          end

          # Serializes the value of a Partitions condition: the presence shortcut
          # ("any"/"none") or the nested quantifier object.
          #
          # @param node [Configs::SearchConditions::Partitions]
          # @return [String, Hash, nil]
          def convert_partitions_value(node)
            return node.presence.to_s if node.presence

            convert_partitions_condition(node.condition) if node.condition
          end

          # Serializes a partitions quantifier node.
          #
          # @param cond [PartitionsAny, PartitionsNone, PartitionsAll, PartitionsCount]
          # @return [Hash, nil]
          def convert_partitions_condition(cond)
            case cond
            when Configs::SearchConditions::PartitionsAny
              { any: convert_condition_node(cond.condition) }
            when Configs::SearchConditions::PartitionsNone
              { none: convert_condition_node(cond.condition) }
            when Configs::SearchConditions::PartitionsAll
              { all: convert_condition_node(cond.condition) }
            when Configs::SearchConditions::PartitionsCount
              { count: convert_partitions_count(cond) }
            end
          end

          # Serializes a PartitionsCount node.
          #
          # @param count [Configs::SearchConditions::PartitionsCount]
          # @return [Hash]
          def convert_partitions_count(count)
            {}.tap do |json|
              json[:condition] = convert_condition_node(count.condition) if count.condition
              json[:min]       = count.min if count.min
              json[:max]       = count.max if count.max
            end
          end

          # Serializes a collection of condition nodes.
          #
          # @param conditions [Array<Configs::SearchConditions::*>]
          # @return [Array<Hash>]
          def convert_conditions(conditions)
            conditions.map { |c| convert_condition_node(c) }
          end

          # @return [Hash, nil]
          def convert_sort
            criteria = config.sort_criteria
            return if criteria.nil? || criteria.empty?

            criteria.map do |criterion|
              { criterion_name(criterion) => criterion_order(criterion) }
            end
          end

          SORT_CRITERIA = {
            Configs::SortCriteria::Name            => :name,
            Configs::SortCriteria::Size            => :size,
            Configs::SortCriteria::PartitionNumber => :number
          }.freeze
          private_constant :SORT_CRITERIA

          # @see #convert_sort
          def criterion_name(criterion)
            SORT_CRITERIA[criterion.class]
          end

          # @see #convert_sort
          def criterion_order(criterion)
            criterion.asc? ? "asc" : "desc"
          end
        end
      end
    end
  end
end
