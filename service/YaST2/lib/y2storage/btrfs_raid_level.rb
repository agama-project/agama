# Copyright (c) [2019-2020] SUSE LLC
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

require "yast/i18n"
require "storage"
require "y2storage/storage_enum_wrapper"

module Y2Storage
  # Class to represent all the possible Btrfs RAID levels
  #
  # This is a wrapper for the Storage::BtrfsRaidLevel enum
  class BtrfsRaidLevel
    include Yast::I18n
    extend Yast::I18n

    include StorageEnumWrapper

    wrap_enum "BtrfsRaidLevel"

    TRANSLATIONS = {
      unknown: N_("Unknown"),
      default: N_("Default"),
      # TRANSLATORS: this is one of the RAID modes used by Btrfs, likely to be left as-is
      single:  N_("SINGLE"),
      # TRANSLATORS: this is one of the RAID modes used by Btrfs, likely to be left as-is
      dup:     N_("DUP"),
      raid0:   N_("RAID0"),
      raid1:   N_("RAID1"),
      raid1c3: N_("RAID1C3"),
      raid1c4: N_("RAID1C4"),
      raid5:   N_("RAID5"),
      raid6:   N_("RAID6"),
      raid10:  N_("RAID10")
    }

    private_constant :TRANSLATIONS

    # Returns human readable representation of enum which is already translated.
    #
    # @raise [RuntimeError] when called on enum value for which translation is not defined yet.
    #
    # @return [String]
    def to_human_string
      textdomain "storage"

      value = TRANSLATIONS[to_sym] or raise "Unhandled Btrfs RAID level value '#{inspect}'"

      _(value)
    end
  end
end
