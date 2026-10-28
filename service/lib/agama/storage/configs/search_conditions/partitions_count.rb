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

module Agama
  module Storage
    module Configs
      module SearchConditions
        # Partitions quantifier: matches when the count of (matching) partitions falls within
        # the given bounds. At least one of min or max must be set.
        class PartitionsCount
          # @return [SearchConditions::*, nil]
          attr_accessor :condition

          # @return [Integer, nil]
          attr_accessor :min

          # @return [Integer, nil]
          attr_accessor :max

          # @param condition [SearchConditions::*, nil]
          # @param min [Integer, nil]
          # @param max [Integer, nil]
          def initialize(condition: nil, min: nil, max: nil)
            @condition = condition
            @min       = min
            @max       = max
          end
        end
      end
    end
  end
end
