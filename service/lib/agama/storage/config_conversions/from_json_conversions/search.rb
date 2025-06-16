# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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
              name:             search_json.dig(:condition, :name),
              size:             convert_size,
              partition_number: search_json.dig(:condition, :number),
              sort_criteria:    convert_sort,
              max:              search_json[:max],
              if_not_found:     search_json[:ifNotFound]&.to_sym
            }
          end

          # @return [String]
          def convert_string
            return { if_not_found: :skip } if search_json == SEARCH_ANYTHING_STRING

            { name: search_json }
          end

          # @return [Configs::SearchConditions::Size, nil]
          def convert_size
            size_json = search_json.dig(:condition, :size)
            return unless size_json

            FromJSONConversions::SearchConditions::Size.new(size_json).convert
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
