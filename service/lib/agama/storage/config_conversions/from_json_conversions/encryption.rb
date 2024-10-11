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
          # @see Base#convert
          # @return [Configs::Encryption]
          def convert
            super(Configs::Encryption.new)
          end

        private

          alias_method :encryption_json, :config_json

          # @see Base#conversions
          # @return [Hash]
          def conversions
            return luks1_conversions if luks1?
            return luks2_conversions if luks2?
            return pervasive_luks2_conversions if pervasive_luks2?

            swap_encryption_conversions
          end

          def luks1?
            return false unless encryption_json.is_a?(Hash)

            !encryption_json[:luks1].nil?
          end

          def luks2?
            return false unless encryption_json.is_a?(Hash)

            !encryption_json[:luks2].nil?
          end

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
          def luks2_conversions
            luks2_json = encryption_json[:luks2]

            {
              method:        Y2Storage::EncryptionMethod::LUKS2,
              password:      convert_password(luks2_json),
              key_size:      convert_key_size(luks2_json),
              cipher:        convert_cipher(luks2_json),
              label:         convert_label,
              pbkd_function: convert_pbkd_function
            }
          end

          # @return [Hash]
          def pervasive_luks2_conversions
            pervasive_json = encryption_json[:pervasiveLuks2]

            {
              method:   Y2Storage::EncryptionMethod::PERVASIVE_LUKS2,
              password: convert_password(pervasive_json)
            }
          end

          # @return [Hash]
          def swap_encryption_conversions
            return {} unless encryption_json.is_a?(String)

            # TODO: Report issue if the schema admits an unknown method.
            method = Y2Storage::EncryptionMethod.find(encryption_json.to_sym)
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
        end
      end
    end
  end
end
