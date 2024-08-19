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
          # @param encryption_json [Hash]
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
              password = convert_password
              method = convert_method
              pbkdf = convert_pbkd_function
              key_size = convert_key_size
              cipher = convert_cipher

              config.password = password if password
              config.method = method if method
              config.pbkd_function = pbkdf if pbkdf
              config.key_size = key_size if key_size
              config.cipher = cipher if cipher
            end
          end

        private

          # @return [Hash]
          attr_reader :encryption_json

          # @return [Configs::Encryption]
          attr_reader :default_config

          # @return [String, nil]
          def convert_password
            encryption_json[:password]
          end

          # @return [Y2Storage::EncryptionMethod, nil]
          def convert_method
            value = encryption_json[:method]
            return unless value

            Y2Storage::EncryptionMethod.find(value.to_sym)
          end

          # @return [Y2Storage::PbkdFunction, nil]
          def convert_pbkd_function
            Y2Storage::PbkdFunction.find(encryption_json[:pbkdFunction])
          end

          # @return [Integer, nil]
          def convert_key_size
            encryption_json[:keySize]
          end

          # @return [String, nil]
          def convert_cipher
            encryption_json[:cipher]
          end
        end
      end
    end
  end
end
