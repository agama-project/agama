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

require "agama/storage/config_conversions/to_json_conversions/base"
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

          # @return [Hash, nil]
          def convert_condition
            convert_condition_name ||
              convert_condition_number ||
              convert_condition_size
          end

          # @return [Hash, nil]
          def convert_condition_name
            name = config.name || config.device&.name
            return unless name

            { name: name }
          end

          # @return [Hash, nil]
          def convert_condition_number
            number = config.partition_number
            return unless number

            { number: number }
          end

          # @return [Hash, nil]
          def convert_condition_size
            size = config.size
            return unless size&.value

            {
              size: { size.operator => size.value.to_i }
            }
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
