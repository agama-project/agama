# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require "agama/storage/configs/encryption"
require "y2storage/encryption_method"
require "y2storage/pbkd_function"

module Agama
  module Storage
    module ConfigConversions
      module Encryption
        # Encryption conversion from JSON hash according to schema.
        class FromJSON
          # @param encryption_json [Hash, String]
          # @param default [Configs::Encrypt]
          def initialize(encryption_json, default: nil)
            @encryption_json = encryption_json
            @default_config = default || Configs::Encryption.new
          end

          # Performs the conversion from Hash according to the JSON schema.
          #
          # @return [Configs::Encryption]
          def convert
            default_config.dup.tap do |config|
              convert_luks1(config) ||
                convert_luks2(config) ||
                convert_pervasive_luks2(config) ||
                convert_swap_encryption(config)
            end
          end

        private

          # @return [Hash, String]
          attr_reader :encryption_json

          # @return [Configs::Encryption]
          attr_reader :default_config

          # @param config [Configs::Encryption]
          # @return [Configs::Encryption, nil] nil if JSON does not match LUKS1 schema.
          def convert_luks1(config)
            luks1_json = encryption_json.is_a?(Hash) && encryption_json[:luks1]
            return unless luks1_json

            key_size = convert_key_size(luks1_json)
            cipher = convert_cipher(luks1_json)

            config.method = Y2Storage::EncryptionMethod::LUKS1
            config.password = convert_password(luks1_json)
            config.key_size = key_size if key_size
            config.cipher = cipher if cipher
          end

          # @param config [Configs::Encryption]
          # @return [Configs::Encryption, nil] nil if JSON does not match LUKS2 schema.
          def convert_luks2(config)
            luks2_json = encryption_json.is_a?(Hash) && encryption_json[:luks2]
            return unless luks2_json

            key_size = convert_key_size(luks2_json)
            cipher = convert_cipher(luks2_json)
            label = convert_label
            pbkdf = convert_pbkd_function

            config.method = Y2Storage::EncryptionMethod::LUKS2
            config.password = convert_password(luks2_json)
            config.key_size = key_size if key_size
            config.cipher = cipher if cipher
            config.label = label if label
            config.pbkd_function = pbkdf if pbkdf
          end

          # @param config [Configs::Encryption]
          # @return [Configs::Encryption, nil] nil if JSON does not match pervasive LUKS2 schema.
          def convert_pervasive_luks2(config)
            pervasive_json = encryption_json.is_a?(Hash) && encryption_json[:pervasive_luks2]
            return unless pervasive_json

            config.method = Y2Storage::EncryptionMethod::PERVASIVE_LUKS2
            config.password = convert_password(pervasive_json)
          end

          # @param config [Configs::Encryption]
          # @return [Configs::Encryption, nil] nil if JSON does not match a swap encryption schema.
          def convert_swap_encryption(config)
            return unless encryption_json.is_a?(String)

            # @todo Report issue if the schema admits an unknown method.
            method = Y2Storage::EncryptionMethod.find(encryption_json.to_sym)
            return unless method

            config.method = method
          end

          # @param method_json [Hash]
          # @return [String, nil]
          def convert_password(method_json)
            method_json[:password]
          end

          # @param method_json [Hash]
          # @return [Integer, nil]
          def convert_key_size(method_json)
            method_json[:keySize]
          end

          # @param method_json [Hash]
          # @return [String, nil]
          def convert_cipher(method_json)
            method_json[:cipher]
          end

          # @return [String, nil]
          def convert_label
            encryption_json.dig(:luks2, :label)
          end

          # @return [Y2Storage::PbkdFunction, nil]
          def convert_pbkd_function
            Y2Storage::PbkdFunction.find(encryption_json.dig(:luks2, :pbkdFunction))
          end
        end
      end
    end
  end
end
