# frozen_string_literal: true

# Copyright (c) [2025-2026] SUSE LLC
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
      # Namespace for conditions used for searching devices.
      module SearchConditions
      end
    end
  end
end

require "agama/storage/configs/search_conditions/size"
require "agama/storage/configs/search_conditions/name"
require "agama/storage/configs/search_conditions/driver"
require "agama/storage/configs/search_conditions/transport"
require "agama/storage/configs/search_conditions/partition_number"
require "agama/storage/configs/search_conditions/partition_id"
require "agama/storage/configs/search_conditions/filesystem"
require "agama/storage/configs/search_conditions/filesystem_type"
require "agama/storage/configs/search_conditions/filesystem_label"
require "agama/storage/configs/search_conditions/partitions"
require "agama/storage/configs/search_conditions/partitions_any"
require "agama/storage/configs/search_conditions/partitions_none"
require "agama/storage/configs/search_conditions/partitions_all"
require "agama/storage/configs/search_conditions/partitions_count"
require "agama/storage/configs/search_conditions/and"
require "agama/storage/configs/search_conditions/or"
require "agama/storage/configs/search_conditions/not"
