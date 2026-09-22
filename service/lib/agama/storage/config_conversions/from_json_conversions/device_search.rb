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
require "agama/storage/config_conversions/from_json_conversions/search_errors"
require "agama/storage/configs/search"
require "agama/storage/configs/search_conditions"
require "agama/storage/configs/sort_criteria"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Base class for the conversion of a search from JSON hash according to schema.
        #
        # This class implements the part of the conversion that is common to every kind of device
        # (the search shortcuts, the max and the ifNotFound values). Each derived class provides
        # the converter for its own conditions and the sort criteria it supports, so a search can
        # only be converted according to the schema of its device (e.g., {DriveSearch}).
        class DeviceSearch < Base
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
              condition:     condition_converter.convert(search_json[:condition]),
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

          # Converter for the conditions supported by the device (defined by derived classes).
          #
          # @return [SearchConditions::Base]
          def condition_converter
            raise "Undefined condition converter"
          end

          # Sort criteria classes supported by the device, indexed by their JSON name (defined by
          # derived classes).
          #
          # @return [Hash{Symbol => Class}]
          def sort_criteria_classes
            raise "Undefined sort criteria"
          end

          # @return [Array<Configs::SortCriteria::Base>]
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

          # @param name [String, Symbol]
          # @param order [String]
          #
          # @return [Configs::SortCriteria::Base]
          def sort_criterion(name, order = "asc")
            crit = sort_criterion_class(name).new
            crit.asc = (order.to_s != "desc")
            crit
          end

          # @raise [UnsupportedSortCriterion] If the criterion is not supported by the device.
          #
          # @param name [String, Symbol]
          # @return [Class]
          def sort_criterion_class(name)
            sort_criteria_classes[name.to_sym] ||
              raise(UnsupportedSortCriterion.new(name, self.class))
          end
        end
      end
    end
  end
end
