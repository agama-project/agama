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
        # Condition for searching by kernel driver.
        #
        # A device can be handled by several drivers, so the condition matches if any of the
        # drivers of the device is the given one.
        class Driver
          # @return [String, nil] e.g., "ahci".
          attr_accessor :driver

          # @param driver [String, nil]
          def initialize(driver = nil)
            @driver = driver
          end
        end
      end
    end
  end
end
