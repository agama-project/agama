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

require "agama/storage/config_conversions/from_json_conversions/search_errors"
require "agama/storage/configs/search_conditions"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        module SearchConditions
          # Base class for converting the condition tree of a search from JSON.
          #
          # This class only implements the device-agnostic part of the conversion (the and, or and
          # not operators). Each derived class supports its own set of leaf conditions, either by
          # defining {#convert_leaf} or by including the corresponding mixins (e.g., {WithName}).
          # A leaf condition not supported by the converter is rejected.
          class Base
            # Converts a condition JSON into a condition config.
            #
            # @raise [UnsupportedSearchCondition] If the JSON contains a condition that is not
            #   supported by the converter.
            #
            # @param json [Hash, nil] nil means "no condition".
            # @return [Configs::SearchConditions::*, nil]
            def convert(json)
              return unless json

              convert_node(json)
            end

          private

            # Recursively converts a condition node.
            #
            # @param json [Object]
            # @return [Configs::SearchConditions::*]
            def convert_node(json)
              unsupported_condition(json) unless json.is_a?(Hash)

              return and_condition(json[:and]) if json.key?(:and)
              return or_condition(json[:or]) if json.key?(:or)
              return not_condition(json[:not]) if json.key?(:not)

              convert_leaf(json)
            end

            # Converts a leaf condition node.
            #
            # This is the end of the chain of leaf converters, see {WithName#convert_leaf}. A leaf
            # condition not supported by the converter is rejected.
            #
            # @param json [Hash]
            # @return [Configs::SearchConditions::*]
            def convert_leaf(json)
              unsupported_condition(json)
            end

            # @raise [UnsupportedSearchCondition]
            #
            # @param json [Object]
            def unsupported_condition(json)
              raise UnsupportedSearchCondition.new(json, self.class)
            end

            # @param json [Array<Hash>]
            # @return [Configs::SearchConditions::And]
            def and_condition(json)
              Configs::SearchConditions::And.new(convert_nodes(json))
            end

            # @param json [Array<Hash>]
            # @return [Configs::SearchConditions::Or]
            def or_condition(json)
              Configs::SearchConditions::Or.new(convert_nodes(json))
            end

            # @param json [Hash]
            # @return [Configs::SearchConditions::Not]
            def not_condition(json)
              Configs::SearchConditions::Not.new(convert_node(json))
            end

            # Converts a collection of condition nodes.
            #
            # @param json [Array<Hash>]
            # @return [Array<Configs::SearchConditions::*>]
            def convert_nodes(json)
              json.map { |c| convert_node(c) }
            end
          end
        end
      end
    end
  end
end
