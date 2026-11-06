# Copyright (c) [2018] SUSE LLC
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
  # Class to represent all the possible cache modes for bcache
  #
  # This is a wrapper for the Storage::CacheMode enum
  class CacheMode
    include StorageEnumWrapper
    include Yast::I18n
    extend Yast::I18n

    wrap_enum "CacheMode"

    TRANSLATIONS = {
      # TRANSLATORS: operation mode for cache. If you are not sure how to translate keep it as it is.
      writethrough: N_("Writethrough"),
      # TRANSLATORS: operation mode for cache. If you are not sure how to translate keep it as it is.
      writeback:    N_("Writeback"),
      # TRANSLATORS: operation mode for cache. If you are not sure how to translate keep it as it is.
      writearound:  N_("Writearound"),
      # TRANSLATORS: operation mode for cache. If you are not sure how to translate keep it as it is.
      none:         N_("None")
    }
    private_constant :TRANSLATIONS

    # Returns human readable representation of enum which is already translated.
    # @return [String]
    # @raise [RuntimeError] when called on enum value for which translation is not yet defined.
    def to_human_string
      textdomain "storage"

      string = TRANSLATIONS[to_sym] or raise "Unhandled Cache mode value '#{inspect}'"

      _(string)
    end
  end
end
