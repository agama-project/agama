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
      # Matchers for searching devices.
      module SearchMatchers
        # Whether the name of the given device matches the search condition.
        #
        # @param config [#search]
        # @param device [Y2Storage::Device]
        #
        # @return [Boolean]
        def match_name?(config, device)
          search = config.search
          return true unless search&.name

          found_device = device.devicegraph.find_by_any_name(search.name)
          found_device&.sid == device.sid
        end

        # Whether the size of the given device matches the search condition.
        #
        # @param _config [#search]
        # @param _device [Y2Storage::Device]
        #
        # @return [Boolean]
        def match_size?(_config, _device)
          # TODO
          true
        end
      end
    end
  end
end
