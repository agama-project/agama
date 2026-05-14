# frozen_string_literal: true

# Copyright (c) [2024-2026] SUSE LLC
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
        # @param bootloader_config [Storage::BootloaderConfig]
        def initialize(config, bootloader_config)
          super()

          textdomain "agama"
          @config = config
          @bootloader_config = bootloader_config
        end

        # Encryption config issues.
        #
        # @return [Array<Issue>]
        def issues
          return [] unless encryption

          [
            missing_password_issue,
            unavailable_method_issue,
            wrong_device_method_issue,
            wrong_bootloader_method_issue
          ].compact
        end

      private

        # @return [#encryption]
        attr_reader :config

        # @return [Storage::BootloaderConfig]
        attr_reader :bootloader_config

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
              # TRANSLATORS: %{crypt_method} is the identifier of the method to encrypt the device
              #   (e.g., "luks1", "random swap").
              _("%{crypt_method} is not available in this system."),
              crypt_method: method.to_human_string
            ),
            kind: IssueClasses::Config::WRONG_ENCRYPTION_METHOD
          )
        end

        # @return [Issue, nil]
        def wrong_device_method_issue
          method = encryption&.method
          return unless method&.only_for_swap?
          return if config.filesystem&.path == Y2Storage::MountPoint::SWAP_PATH.to_s

          error(
            format(
              # TRANSLATORS: %{crypt_method} is the identifier of the method to encrypt the device
              #   (e.g., "luks1", "random swap").
              _("%{crypt_method} is not suitable for a device different to swap."),
              crypt_method: method.to_human_string
            ),
            kind: IssueClasses::Config::WRONG_ENCRYPTION_METHOD
          )
        end

        # @return [Issue, nil]
        def wrong_bootloader_method_issue
          method = encryption&.method
          error = tpm_bls_error? || tpm_fde_error?

          return unless method && error

          error(
            format(
              # TRANSLATORS: %{crypt_method} is the identifier of the method to encrypt the device
              #   (e.g., "luks1", "random swap") and %{bootloader} by a bootloader name (e.g.,
              #   "grub2").
              _("%{crypt_method} is not suitable for the bootloader %{bootloader}."),
              crypt_method: method.to_human_string,
              bootloader:   bootloader_config.type&.to_s
            ),
            kind: IssueClasses::Config::WRONG_ENCRYPTION_METHOD
          )
        end

        # @see #unavailable_method_issue
        #
        # @return [Array<Y2Storage::EncryptionMethod::Base>]
        def available_encryption_methods
          tpm_fde = Y2Storage::EncryptionMethod::TPM_FDE
          tpm_bls = Y2Storage::EncryptionMethod::TPM_BLS

          methods = Y2Storage::EncryptionMethod.available
          methods << tpm_fde if tpm_fde.possible?
          methods << tpm_bls if tpm_bls.possible?
          methods
        end

        # Whether the encryption is TPM BLS and it cannot be used with the configured bootloader.
        #
        # @return [Boolean]
        def tpm_bls_error?
          return false unless encryption&.method&.is?(:tpm_bls)

          return false unless bootloader_config.type

          !bootloader_config.type.bls?
        end

        # Whether the encryption is TPM FDE and it cannot be used with the configured bootloader.
        #
        # @return [Boolean]
        def tpm_fde_error?
          return false unless encryption&.method&.is?(:tpm_fde)

          return false unless bootloader_config.type

          !bootloader_config.type.is?(:grub2)
        end
      end
    end
  end
end
