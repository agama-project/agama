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
        # Mixin for matchers supporting the size condition.
        module WithSize
        private

          # @see Base#match_leaf?
          def match_leaf?(node, device)
            return match_size?(node, device) if node.is_a?(Configs::SearchConditions::Size)

            super
          end

          # Whether the size of the given device matches the condition node.
          #
          # @param node [Configs::SearchConditions::Size]
          # @param device [Y2Storage::Device]
          #
          # @return [Boolean]
          def match_size?(node, device)
            return true unless node.value

            case node.operator
            when :equal
              device.size == node.value
            when :greater
              device.size > node.value
            when :less
              device.size < node.value
            else
              false
            end
          end
        end
      end
    end
  end
end
