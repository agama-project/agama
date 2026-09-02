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
        # Condition for searching by partitions presence or properties.
        #
        # Either a presence shortcut (:any for devices with partitions, :none for devices without)
        # or a quantifier condition over the partitions (PartitionsAny, PartitionsNone,
        # PartitionsAll, PartitionsCount).
        class Partitions
          # @return [:any, :none, nil]
          attr_accessor :presence

          # @return [PartitionsAny, PartitionsNone, PartitionsAll, PartitionsCount, nil]
          attr_accessor :condition

          # @param presence [:any, :none, nil]
          # @param condition [PartitionsAny, PartitionsNone, PartitionsAll, PartitionsCount, nil]
          def initialize(presence: nil, condition: nil)
            @presence  = presence
            @condition = condition
          end
        end
      end
    end
  end
end
