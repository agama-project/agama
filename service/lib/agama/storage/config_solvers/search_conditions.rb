# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
    module ConfigSolvers
      # Conditions for searching devices.
      module SearchConditions
        # Search by name condition.
        #
        # @param search [Configs::Search]
        # @return [Proc] Accepts a device and returns whether the device matches.
        def name_condition(search)
          return proc { true } unless search.name

          device = devicegraph.find_by_any_name(search.name)
          proc { |d| d.sid == device&.sid }
        end

        # Search by size condition.
        #
        # @param _search [Configs::Search]
        # @return [Proc] Accepts a device and returns whether the device matches.
        def size_condition(_search)
          # TODO
          proc { true }
        end
      end
    end
  end
end
