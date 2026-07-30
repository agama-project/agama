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
        # Mixin for matchers supporting the driver condition.
        #
        # Only for matchers whose subject is a device with drivers (that is, a drive).
        module WithDriver
        private

          # @see Base#match_leaf?
          def match_leaf?(node, device)
            return match_driver?(node, device) if node.is_a?(Configs::SearchConditions::Driver)

            super
          end

          # Whether any of the drivers of the given device matches the condition node.
          #
          # @param node [Configs::SearchConditions::Driver]
          # @param device [Y2Storage::BlkDevice]
          #
          # @return [Boolean]
          def match_driver?(node, device)
            return true unless node.driver

            device.driver.include?(node.driver)
          end
        end
      end
    end
  end
end
