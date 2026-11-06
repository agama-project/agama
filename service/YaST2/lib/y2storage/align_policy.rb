# Copyright (c) [2017] SUSE LLC
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
  # Class to represent all the possible align policies implemented by libstorage
  #
  #   * AlignPolicy::ALIGN_START_AND_END to align both start and end
  #   * AlignPolicy::ALIGN_END is a deprecated equivalent to ALIGN_START_AND_END
  #   * AlignPolicy::ALIGN_START_KEEP_END to align the start and keep the end
  #   * AlignPolicy::KEEP_END is a deprecated equivalent to ALIGN_START_KEEP_END
  #   * AlignPolicy::ALIGN_START_KEEP_SIZE to align the start and keep the exact size
  #   * AlignPolicy::KEEP_SIZE is a deprecated equivalent to ALIGN_START_KEEP_SIZE
  #   * AlignPolicy::KEEP_START_ALIGN_END to align only the end, leaving the
  #     start untouched
  #
  # This is a wrapper for the Storage::AlignPolicy enum
  class AlignPolicy
    include StorageEnumWrapper

    wrap_enum "AlignPolicy"
  end
end
