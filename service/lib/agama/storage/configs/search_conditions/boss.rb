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
        # Condition for searching BOSS (Boot Optimized Storage Solution) devices.
        #
        # A device with an unknown model is never a BOSS device.
        class Boss
          # @return [Boolean, nil] whether the device must be a BOSS device.
          attr_accessor :boss

          # @param boss [Boolean, nil]
          def initialize(boss = nil)
            @boss = boss
          end
        end
      end
    end
  end
end
