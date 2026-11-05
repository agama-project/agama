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
  # Class to represent all the possible MD parities
  #
  # This is a wrapper for the Storage::MdParity enum
  class MdParity
    include StorageEnumWrapper
    include Yast::I18n
    extend Yast::I18n

    wrap_enum "MdParity"

    TRANSLATIONS = {
      # TODO: should be tested by some real OPS guy, I (JR) pick human wording from `man mdadm`
      default:            N_("Default"),
      left_asymmetric:    N_("Left asymmetric"),
      left_symmetric:     N_("Left symmetric"),
      right_asymmetric:   N_("Right asymmetric"),
      right_symmetric:    N_("Right symmetric"),
      first:              N_("Parity first"),
      last:               N_("Parity last"),

      # NOTE: parity with _6 suffix is for converting raid 5 to 6 and is only intermediate state
      left_asymmetric_6:  N_("Left asymmetric RAID6"),
      left_symmetric_6:   N_("Left symmetric RAID6"),
      right_asymmetric_6: N_("Right asymmetric RAID6"),
      right_symmetric_6:  N_("Right symmetric RAID6"),
      first_6:            N_("Parity first RAID6"),
      last_6:             N_("Parity last RAID6"),

      near_2:             N_("Two copies near"),
      near_3:             N_("Three copies near"),
      offset_2:           N_("Two copies offset"),
      offset_3:           N_("Three copies offset"),
      far_2:              N_("Two copies far"),
      far_3:              N_("Three copies far")
    }
    private_constant :TRANSLATIONS

    # Matching between identifiers for parity_algorithm in the old libstorage and the current ones
    LEGACY_TO_CURRENT = {
      parity_first:   :first,
      parity_last:    :last,
      parity_first_6: :first_6,
      n2:             :near_2,
      o2:             :offset_2,
      f2:             :far_2,
      n3:             :near_3,
      o3:             :offset_3,
      f3:             :far_3
    }.freeze
    private_constant :LEGACY_TO_CURRENT

    # Parity corresponding to the given identifier
    #
    # Before storage-ng (SLE <= 12.x) some MD parities were represented by a slightly different
    # indentifier in the AutoYaST profiles. This method returns the corresponding value of the
    # enum, no matter if an old or a modern representation is given.
    #
    # @param id [#to_sym] identifier of the parity
    # @return [MdParity, nil] nil if the given id is not recognized
    def self.find_with_legacy(id)
      id = LEGACY_TO_CURRENT[id.to_sym] if LEGACY_TO_CURRENT.key?(id.to_sym)
      find(id)
    rescue NameError
      nil
    end

    # Returns human readable representation of enum which is already translated.
    # @return [String]
    # @raise [RuntimeError] when called on enum value for which translation is not yet defined.
    def to_human_string
      textdomain "storage"

      string = TRANSLATIONS[to_sym] or raise "Unhandled MD raid parity value '#{inspect}'"

      _(string)
    end
  end
end
