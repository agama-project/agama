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

require "agama/storage/configs/search_conditions"

module Agama
  module Storage
    module ConfigSolvers
      module SearchMatchers
        # Base class for matching a search condition against a subject.
        #
        # The subject is the object the condition is evaluated against (e.g., a device or a
        # filesystem). This class only implements the subject-agnostic part of the matching (the
        # and, or and not operators). Each derived class supports its own set of leaf conditions,
        # either by defining {#match_leaf?} or by including the corresponding mixins (e.g.,
        # {WithName}). A leaf condition not supported by the matcher never matches.
        class Base
          # Whether the given subject matches the condition.
          #
          # @param condition [Configs::SearchConditions::*, nil] nil matches any subject.
          # @param subject [Object] Typically a device or a filesystem.
          #
          # @return [Boolean]
          def match?(condition, subject)
            return true unless condition

            match_node?(condition, subject)
          end

        private

          # Recursively evaluates a condition node against the subject.
          #
          # @param node [Configs::SearchConditions::*]
          # @param subject [Object]
          #
          # @return [Boolean]
          def match_node?(node, subject)
            case node
            when Configs::SearchConditions::And
              node.conditions.all? { |c| match_node?(c, subject) }
            when Configs::SearchConditions::Or
              node.conditions.any? { |c| match_node?(c, subject) }
            when Configs::SearchConditions::Not
              !match_node?(node.condition, subject)
            else
              match_leaf?(node, subject)
            end
          end

          # Evaluates a leaf condition node against the subject.
          #
          # This is the end of the chain of leaf matchers, see {WithName#match_leaf?}. A leaf
          # condition not supported by the matcher never matches.
          #
          # @param _node [Configs::SearchConditions::*]
          # @param _subject [Object]
          #
          # @return [Boolean]
          def match_leaf?(_node, _subject)
            false
          end
        end
      end
    end
  end
end
