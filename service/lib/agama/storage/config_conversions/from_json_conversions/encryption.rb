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

require "agama/storage/config_conversions/from_json_conversions/base"
require "agama/storage/configs/encryption"
require "y2storage/encryption_method"
require "y2storage/pbkd_function"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Encryption conversion from JSON hash according to schema.
        class Encryption < Base
          # @param config_json [Hash]
          # @param bootloader_config [BootloaderConfig]
          def initialize(config_json, bootloader_config)
            super(config_json)
            @bootloader_config = bootloader_config
          end

        private

          # @return [BootloaderConfig]
          attr_reader :bootloader_config

          alias_method :encryption_json, :config_json

          # @see Base
          # @return [Configs::Encryption]
          def default_config
            Configs::Encryption.new
          end

          # @see Base#conversions
          # @return [Hash]
          def conversions
            return luks1_conversions if luks1?
            return luks2_conversions if luks2?
            return tpm_fde_conversions if tpm_fde?
            return tpm_bls_conversions if tpm_bls?
            return pervasive_luks2_conversions if pervasive_luks2?

            swap_encryption_conversions
          end

          # @return [Boolean]
          def luks1?
            return false unless encryption_json.is_a?(Hash)

            !encryption_json[:luks1].nil?
          end

          # @return [Boolean]
          def luks2?
            luks2_schema? && !tpm_fde? && !tpm_bls?
          end

          # @return [Boolean]
          def tpm_fde?
            return true if tpm_fde_schema?

            luks2_schema? &&
              encryption_json.dig(:luks2, :tpm) &&
              bootloader_config.type&.is?(:grub2)
          end

          # @return [Boolean]
          def tpm_bls?
            luks2_schema? && encryption_json.dig(:luks2, :tpm) && bootloader_config.type&.bls?
          end

          # @return [Boolean]
          def pervasive_luks2?
            return false unless encryption_json.is_a?(Hash)

            !encryption_json[:pervasiveLuks2].nil?
          end

          # @return [Hash]
          def luks1_conversions
            luks1_json = encryption_json[:luks1]

            {
              method:   Y2Storage::EncryptionMethod::LUKS1,
              password: convert_password(luks1_json),
              key_size: convert_key_size(luks1_json),
              cipher:   convert_cipher(luks1_json)
            }
          end

          # @return [Hash]
          def luks2_common_conversions
            luks2_json = encryption_json[:luks2]
            return {} unless luks2_json

            {
              password:      convert_password(luks2_json),
              key_size:      convert_key_size(luks2_json),
              cipher:        convert_cipher(luks2_json),
              label:         convert_label,
              pbkd_function: convert_pbkd_function
            }
          end

          # @return [Hash]
          def luks2_conversions
            luks2_common_conversions.merge({
              method: Y2Storage::EncryptionMethod::LUKS2
            })
          end

          # @return [Hash]
          def tpm_fde_conversions
            if tpm_fde_schema?
              tpm_fde_json = encryption_json[:tpmFde]

              return {
                method:   Y2Storage::EncryptionMethod::TPM_FDE,
                password: convert_password(tpm_fde_json)
              }
            end

            luks2_common_conversions.merge({
              method: Y2Storage::EncryptionMethod::TPM_FDE
            })
          end

          # @return [Hash]
          def tpm_bls_conversions
            luks2_common_conversions.merge({
              method: Y2Storage::EncryptionMethod::TPM_BLS
            })
          end

          # @return [Hash]
          def pervasive_luks2_conversions
            pervasive_json = encryption_json[:pervasiveLuks2]

            {
              method:             Y2Storage::EncryptionMethod::PERVASIVE_LUKS2,
              password:           convert_password(pervasive_json),
              apqns:              pervasive_json[:apqns] || [],
              pervasive_key_type: pervasive_json[:keyType]
            }
          end

          # @return [Hash]
          def swap_encryption_conversions
            return {} unless encryption_json.is_a?(String)

            # TODO: Report issue if the schema admits an unknown method.
            # Normalize camelCase to snake_case (y2storage uses "random_swap", "tmp_fde", etc.).
            normalized = encryption_json.gsub(/([a-z])([A-Z])/, '\1_\2').downcase
            method = Y2Storage::EncryptionMethod.find(normalized.to_sym)
            return {} unless method

            {
              method: method
            }
          end

          # @param json [Hash]
          # @return [String, nil]
          def convert_password(json)
            json[:password]
          end

          # @param json [Hash]
          # @return [Integer, nil]
          def convert_key_size(json)
            json[:keySize]
          end

          # @param json [Hash]
          # @return [String, nil]
          def convert_cipher(json)
            json[:cipher]
          end

          # @return [String, nil]
          def convert_label
            encryption_json.dig(:luks2, :label)
          end

          # @return [Y2Storage::PbkdFunction, nil]
          def convert_pbkd_function
            Y2Storage::PbkdFunction.find(encryption_json.dig(:luks2, :pbkdFunction))
          end

          # @return [Boolean]
          def luks2_schema?
            return false unless encryption_json.is_a?(Hash)

            !encryption_json[:luks2].nil?
          end

          # @return [Boolean]
          def tpm_fde_schema?
            return false unless encryption_json.is_a?(Hash)

            !encryption_json[:tpmFde].nil?
          end
        end
      end
    end
  end
end
