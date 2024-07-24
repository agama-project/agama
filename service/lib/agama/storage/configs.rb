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
    module Configs
    end
  end
end

require "agama/storage/configs/boot"
require "agama/storage/configs/btrfs"
require "agama/storage/configs/drive"
require "agama/storage/configs/encrypt"
require "agama/storage/configs/format"
require "agama/storage/configs/mount"
require "agama/storage/configs/partition"
require "agama/storage/configs/search"
require "agama/storage/configs/size"
