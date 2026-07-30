# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require "agama/storage/config_conversions/from_json_conversions/base"
require "agama/storage/configs/search_conditions"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        module SearchConditions
          # Partitions condition conversion from JSON according to schema.
          class Partitions < Base
          private

            # @see Base
            # @return [Configs::SearchConditions::Partitions]
            def default_config
              Configs::SearchConditions::Partitions.new
            end

            alias_method :partitions_json, :config_json

            # @see Base#conversions
            # @return [Hash]
            def conversions
              {
                presence:  convert_presence,
                condition: convert_condition
              }
            end

            # @return [Symbol, nil] :any or :none for the presence shortcut, nil otherwise.
            def convert_presence
              return unless partitions_json.is_a?(String)

              partitions_json.to_sym
            end

            # Converts a partitions quantifier JSON into a quantifier config.
            #
            # @return [Configs::SearchConditions::PartitionsAny,
            #   Configs::SearchConditions::PartitionsNone,
            #   Configs::SearchConditions::PartitionsAll,
            #   Configs::SearchConditions::PartitionsCount, nil]
            def convert_condition
              return if partitions_json.is_a?(String) || partitions_json.nil?

              _key, builder = quantifier_builders.find { |k, _| partitions_json.key?(k) }
              builder&.call(partitions_json)
            end

            # Builders for each quantifier form, indexed by its JSON key.
            #
            # @return [Hash{Symbol => Proc}]
            def quantifier_builders
              {
                any:   ->(j) { partitions_any(j[:any]) },
                none:  ->(j) { partitions_none(j[:none]) },
                all:   ->(j) { partitions_all(j[:all]) },
                count: ->(j) { convert_count(j[:count]) }
              }
            end

            def partitions_any(json)
              Configs::SearchConditions::PartitionsAny.new(convert_partition_condition(json))
            end

            def partitions_none(json)
              Configs::SearchConditions::PartitionsNone.new(convert_partition_condition(json))
            end

            def partitions_all(json)
              Configs::SearchConditions::PartitionsAll.new(convert_partition_condition(json))
            end

            # Builds a PartitionsCount from a count JSON.
            #
            # @param json [Hash]
            # @return [Configs::SearchConditions::PartitionsCount]
            def convert_count(json)
              Configs::SearchConditions::PartitionsCount.new(
                condition: json[:condition] ? convert_partition_condition(json[:condition]) : nil,
                min:       json[:min],
                max:       json[:max]
              )
            end

            # Converts a partition condition JSON into a condition config.
            #
            # @param json [Hash]
            # @return [Configs::SearchConditions::*]
            def convert_partition_condition(json)
              _key, builder = partition_condition_builders.find { |k, _| json.key?(k) }
              builder&.call(json)
            end

            # Converts a collection of partition condition JSONs into condition configs.
            #
            # @param json [Array<Hash>]
            # @return [Array]
            def convert_partition_conditions(json)
              json.map { |c| convert_partition_condition(c) }
            end

            def partition_and_condition(json)
              Configs::SearchConditions::And.new(convert_partition_conditions(json))
            end

            def partition_or_condition(json)
              Configs::SearchConditions::Or.new(convert_partition_conditions(json))
            end

            def partition_not_condition(json)
              Configs::SearchConditions::Not.new(convert_partition_condition(json))
            end

            # Builders for each type of partition condition, indexed by its JSON key.
            #
            # @return [Hash{Symbol => Proc}]
            def partition_condition_builders
              {
                name:       ->(j) { Configs::SearchConditions::Name.new(j[:name]) },
                size:       ->(j) { SearchConditions::Size.new(j[:size]).convert },
                number:     ->(j) { Configs::SearchConditions::PartitionNumber.new(j[:number]) },
                filesystem: ->(j) { SearchConditions::Filesystem.new(j[:filesystem]).convert },
                and:        ->(j) { partition_and_condition(j[:and]) },
                or:         ->(j) { partition_or_condition(j[:or]) },
                not:        ->(j) { partition_not_condition(j[:not]) }
              }
            end
          end
        end
      end
    end
  end
end
