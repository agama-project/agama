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
  # Class to represent all the possible encryption types implemented by libstorage
  #
  # This is the technology used to perform the encryption at low level, as
  # managed by libstorage-ng. Not to be confused with the YaST-specific
  # {EncryptionMethod}, which represents a higher level abstraction.
  #
  # This is a wrapper for the Storage::EncryptionType enum
  #
  # @note Take into account that EncryptionType::LUKS exists only as a legacy
  # alias provided by libstorage-ng for EncryptionType::LUKS1. In general, LUKS
  # should not be used as a constant (use LUKS1 instead) and :luks should not be
  # used as it's symbol counterpart.
  #
  # @example Surprising but correct behaviour of EncryptionType::LUKS
  #   # This is what you would expect
  #   type = EncryptionType::LUKS1
  #   type.to_sym  # => :luks1
  #   type.is?(:luks1)  # => true
  #   type.is?(:luks)   # => false
  #   # But this may be kind of unexpected
  #   type = EncryptionType::LUKS
  #   type.to_sym  # => :luks1
  #   type.is?(:luks1)  # => true
  #   type.is?(:luks)   # => false
  #
  class EncryptionType
    include StorageEnumWrapper
    include Yast::I18n
    extend Yast::I18n

    wrap_enum "EncryptionType"

    TRANSLATIONS = {
      unknown:        N_("Unknown encryption"),
      none:           N_("No encryption"),
      twofish:        N_("Twofish"),
      twofish_old:    N_("Old Twofish (loop_fish2)"),
      twofish256_old: N_("Old Twofish (loop_fish2) 256-bit"),
      luks1:          N_("LUKS1"),
      luks2:          N_("LUKS2"),
      bitlocker:      N_("BitLocker"),
      plain:          N_("Plain encryption")
    }
    private_constant :TRANSLATIONS

    # Returns human readable representation of enum which is already translated.
    #
    # @raise [RuntimeError] when called on enum value for which translation is not yet defined.
    # @return [String]
    def to_human_string
      textdomain "storage"

      string = TRANSLATIONS[to_sym] or raise "Unhandled encryption type '#{inspect}'"

      _(string)
    end

    # @return [Symbol]
    def to_sym
      res = super

      # The EncryptionType is defined like this in libstorage-ng
      # enum class EncryptionType {...LUKS, LUKS1 = LUKS, LUKS2...}
      #
      # That means #to_sym always returns :luks1 for EncryptionType::LUKS.
      # Always... except in one exceptional testing virtual machine in which it
      # sometimes returns :luks for completely unknown reasons.
      return :luks1 if res == :luks

      res
    end
  end
end
