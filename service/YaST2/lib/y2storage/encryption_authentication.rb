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

require "y2storage/tpm"
require "yast"

module Y2Storage
  # Class for describing an authentication type of encrypted block devices.
  #
  # The value will only be used for systemd_fde encryption. It will be
  # set in yast-storage-ng BUT will be only used in yast-bootmanager after the
  # bootmanager has been installed.
  class EncryptionAuthentication
    include Yast::I18n
    extend Yast::I18n
    include Yast2::Equatable

    # Constructor, to be used internally by the class
    #
    # @param value [String] see {#value}
    # @param name [String] string marked for translation, see {#name}
    def initialize(value, name)
      textdomain "storage"

      @value = value
      @name = name
    end

    # Instance of the function to be always returned by the class
    # TRANSLATORS: authentication type for encrypted devices.
    PASSWORD = new("password", N_("Only Password"))
    # TRANSLATORS: authentication type for encrypted devices.
    TPM2 = new("tpm2", N_("TPM2"))
    # TRANSLATORS: authentication type for encrypted devices.
    TPM2PIN = new("tpm2+pin", N_("TPM2 and PIN"))
    # TRANSLATORS: authenticationtype for encrypted devices.
    FIDO2 = new("fido2", N_("FIDO2"))

    # All possible instances
    ALL = [PASSWORD, TPM2, TPM2PIN, FIDO2].freeze
    private_constant :ALL
    NONE_TPM = [PASSWORD, FIDO2].freeze
    private_constant :NONE_TPM

    # Sorted list of all possible authentications
    def self.all
      Tpm.instance.policy_authorize_nv? ? ALL.dup : NONE_TPM.dup
    end

    # Finds a function by its value
    #
    # @param value [#to_s]
    # @return [EncryptionAuthentication, nil] nil if such value does not exist
    def self.find(value)
      ALL.find { |opt| opt.value == value.to_s }
    end

    # Help text with a list of all supported authentications.
    #
    # @return [String] help text
    def self.auth_list_help_text
      textdomain "storage"

      format(_("<ul>" \
               "<li><i>%{only_password}: </i>Password is required.</li>" \
               "<li><i>%{tpm2}: </i>A crypto-device that is already present in your system.</li>" \
               "<li><i>%{tpm2_and_pin}: </i>Like TPM2, but a password must be enter together.</li>" \
               "<li><i>%{fido2}: </i>External key device.</li>" \
               "</ul>"), only_password: PASSWORD.name, tpm2: TPM2.name,
        tpm2_and_pin: TPM2PIN.name, fido2: FIDO2.name)
    end

    # @return [String] value
    attr_reader :value

    # @return [String] localized name to display in the UI
    def name
      _(@name)
    end

    alias_method :to_s, :value

    # @return [Symbol]
    def to_sym
      value.to_sym
    end

    # Checks whether the object corresponds to any of the given enum values.
    #
    # By default, this will be the base comparison used in the case statements.
    #
    # @param names [#to_sym]
    # @return [Boolean]
    def is?(*names)
      names.any? { |n| n.to_sym == to_sym }
    end
  end
end
