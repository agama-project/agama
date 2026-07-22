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

require "agama/storage/config_conversions/from_json_conversions/base"
require "agama/storage/config_conversions/from_json_conversions/search_conditions"
require "agama/storage/configs/search"
require "agama/storage/configs/search_conditions"
require "agama/storage/configs/sort_criteria"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Search conversion from JSON hash according to schema.
        class Search < Base
        private

          # @see Base
          # @return [Configs::Search]
          def default_config
            Configs::Search.new
          end

          # Reserved search value meaning 'match all devices or ignore the section'.
          #
          # { search: "*" } is a shortcut for { search: { ifNotFound: "skip" } }.
          SEARCH_ANYTHING_STRING = "*"
          private_constant :SEARCH_ANYTHING_STRING

          alias_method :search_json, :config_json

          # @see Base#conversions
          # @return [Hash]
          def conversions
            return convert_string if search_json.is_a?(String)

            {
              condition:     convert_condition(search_json[:condition]),
              sort_criteria: convert_sort,
              max:           search_json[:max],
              if_not_found:  search_json[:ifNotFound]&.to_sym
            }
          end

          # @return [Hash]
          def convert_string
            return { if_not_found: :skip } if search_json == SEARCH_ANYTHING_STRING

            { condition: Configs::SearchConditions::Name.new(search_json) }
          end

          # Recursively converts a condition JSON into a condition config.
          #
          # @param json [Hash, nil]
          # @return [Configs::SearchConditions::Name, Configs::SearchConditions::Size,
          #   Configs::SearchConditions::PartitionNumber, Configs::SearchConditions::And,
          #   Configs::SearchConditions::Or, Configs::SearchConditions::Not, nil]
          def convert_condition(json)
            return unless json

            _key, builder = condition_builders.find { |k, _| json.key?(k) }
            builder&.call(json)
          end

          # Builders for each type of condition, indexed by its JSON key.
          #
          # @return [Hash{Symbol => Proc}]
          def condition_builders
            {
              name:       ->(j) { Configs::SearchConditions::Name.new(j[:name]) },
              size:       ->(j) { SearchConditions::Size.new(j[:size]).convert },
              number:     ->(j) { Configs::SearchConditions::PartitionNumber.new(j[:number]) },
              filesystem: ->(j) { SearchConditions::Filesystem.new(j[:filesystem]).convert },
              and:        ->(j) { Configs::SearchConditions::And.new(convert_conditions(j[:and])) },
              or:         ->(j) { Configs::SearchConditions::Or.new(convert_conditions(j[:or])) },
              not:        ->(j) { Configs::SearchConditions::Not.new(convert_condition(j[:not])) }
            }
          end

          # Converts a collection of condition JSONs into condition configs.
          #
          # @param json [Array<Hash>]
          # @return [Array]
          def convert_conditions(json)
            json.map { |c| convert_condition(c) }
          end

          def convert_sort
            Array(search_json[:sort]).map do |entry|
              case entry
              when Array
                sort_criterion(entry.first, entry.last)
              when Hash
                sort_criterion(entry.keys.first, entry.values.first)
              else
                sort_criterion(entry)
              end
            end
          end

          def sort_criterion(name, order = "asc")
            crit = sort_criterion_class(name).new
            crit.asc = (order.to_s != "desc")
            crit
          end

          SORT_CRITERIA = {
            name:   Configs::SortCriteria::Name,
            size:   Configs::SortCriteria::Size,
            number: Configs::SortCriteria::PartitionNumber
          }.freeze
          private_constant :SORT_CRITERIA

          def sort_criterion_class(name)
            SORT_CRITERIA[name.to_sym]
          end
        end
      end
    end
  end
end
