# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require "agama/storage/config_conversions/block_device"
require "agama/storage/config_conversions/drive"
require "agama/storage/config_conversions/encryption"
require "agama/storage/config_conversions/filesystem"
require "agama/storage/config_conversions/from_json"
require "agama/storage/config_conversions/partition"
require "agama/storage/config_conversions/partitionable"
require "agama/storage/config_conversions/search"
require "agama/storage/config_conversions/size"

module Agama
  module Storage
    # Conversions for the storage config.
    module ConfigConversions
    end
  end
end
