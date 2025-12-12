# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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

require "agama/storage/config_checkers/base"
require "yast/i18n"
require "y2storage/encryption_method"
require "y2storage/mount_point"

module Agama
  module Storage
    module ConfigCheckers
      # Class for checking the encryption config.
      class Encryption < Base
        include Yast::I18n

        # @param config [#encryption]
        def initialize(config)
          super()

          textdomain "agama"
          @config = config
        end

        # Encryption config issues.
        #
        # @return [Array<Issue>]
        def issues
          return [] unless encryption

          [
            missing_password_issue,
            unavailable_method_issue,
            wrong_method_issue
          ].compact
        end

      private

        # @return [#encryption]
        attr_reader :config

        # @return [Configs::Encryption, nil]
        def encryption
          config.encryption
        end

        # @return [Issue, nil]
        def missing_password_issue
          return unless encryption.missing_password?

          error(
            format(
              # TRANSLATORS: 'crypt_method' is the identifier of the method to encrypt the device
              #   (e.g., 'luks1', 'random_swap').
              _("No passphrase provided (required for using the method '%{crypt_method}')."),
              crypt_method: encryption.method.to_human_string
            ),
            kind: IssueClasses::Config::NO_ENCRYPTION_PASSPHRASE
          )
        end

        # @return [Issue, nil]
        def unavailable_method_issue
          method = encryption.method
          return if !method || available_encryption_methods.include?(method)

          error(
            format(
              # TRANSLATORS: 'crypt_method' is the identifier of the method to encrypt the device
              #   (e.g., 'luks1', 'random_swap').
              _("Encryption method '%{crypt_method}' is not available in this system."),
              crypt_method: method.to_human_string
            ),
            kind: IssueClasses::Config::WRONG_ENCRYPTION_METHOD
          )
        end

        # @see #unavailable_method_issue
        #
        # @return [Array<Y2Storage::EncryptionMethod::Base>]
        def available_encryption_methods
          tpm_fde = Y2Storage::EncryptionMethod::TPM_FDE

          methods = Y2Storage::EncryptionMethod.available
          methods << tpm_fde if tpm_fde.possible?
          methods
        end

        # @return [Issue, nil]
        def wrong_method_issue
          method = encryption&.method
          return unless method&.only_for_swap?
          return if config.filesystem&.path == Y2Storage::MountPoint::SWAP_PATH.to_s

          error(
            format(
              # TRANSLATORS: 'crypt_method' is the identifier of the method to encrypt the device
              #   (e.g., 'luks1', 'random_swap').
              _("'%{crypt_method}' is not a suitable method to encrypt the device."),
              crypt_method: method.to_human_string
            ),
            kind: IssueClasses::Config::WRONG_ENCRYPTION_METHOD
          )
        end
      end
    end
  end
end
