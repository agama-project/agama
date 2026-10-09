# Copyright (c) [2019] SUSE LLC
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

require "y2storage/storage_enum_wrapper"

module Y2Storage
  # Class to represent all the possible bcache types
  #
  # Bcache technology supports two types of bcache devices. Bcache devices with a backing
  # device and also bcache devices directly created over a caching set (without backing
  # device associated to it). This second type is known as flash-only bcache.
  #
  # This is a wrapper for the Storage::BcacheType enum
  class BcacheType
    include StorageEnumWrapper

    wrap_enum "BcacheType"
  end
end
