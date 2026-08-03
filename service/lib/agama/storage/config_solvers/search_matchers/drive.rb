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

require "agama/storage/config_solvers/search_matchers/base"
require "agama/storage/config_solvers/search_matchers/with_driver"
require "agama/storage/config_solvers/search_matchers/with_filesystem"
require "agama/storage/config_solvers/search_matchers/with_name"
require "agama/storage/config_solvers/search_matchers/with_partitions"
require "agama/storage/config_solvers/search_matchers/with_size"

module Agama
  module Storage
    module ConfigSolvers
      module SearchMatchers
        # Matcher for the conditions of a drive search.
        class Drive < Base
          include WithName
          include WithSize
          include WithDriver
          include WithFilesystem
          include WithPartitions
        end
      end
    end
  end
end
