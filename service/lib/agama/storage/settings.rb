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

module Agama
  module Storage
    # Namespace for all the supported settings to configure storage
    module Settings
    end
  end
end

require "agama/storage/settings/drive"
require "agama/storage/settings/encrypt"
require "agama/storage/settings/format"
require "agama/storage/settings/mount"
require "agama/storage/settings/partition"
require "agama/storage/settings/search"
require "agama/storage/settings/size_range"
