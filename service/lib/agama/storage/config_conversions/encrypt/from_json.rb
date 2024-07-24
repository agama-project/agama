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

require "agama/storage/configs/encrypt"
require "y2storage/encryption_method"
require "y2storage/pbkd_function"

module Agama
  module Storage
    module ConfigConversions
      module Encrypt
        # Encrypt conversion from JSON hash according to schema.
        class FromJSON
          # @param encrypt_json [Hash]
          # @param default [Configs::Encrypt]
          def initialize(encrypt_json, default: nil)
            @encrypt_json = encrypt_json
            @default_config = default || Configs::Encrypt.new
          end

          # Performs the conversion from Hash according to the JSON schema.
          #
          # @return [Configs::Encrypt]
          def convert
            default_config.dup.tap do |config|
              key = convert_key
              method = convert_method
              pbkdf = convert_pbkd_function

              config.key = key if key
              config.method = method if method
              config.pbkd_function = pbkdf if pbkdf
            end
          end

        private

          # @return [Hash]
          attr_reader :encrypt_json

          # @return [Configs::Encrypt]
          attr_reader :default_config

          # @return [String, nil]
          def convert_key
            encrypt_json[:password]
          end

          # @return [Y2Storage::EncryptionMethod, nil]
          def convert_method
            value = encrypt_json[:method]
            return unless value

            Y2Storage::EncryptionMethod.find(value.to_sym)
          end

          # @return [Y2Storage::PbkdFunction, nil]
          def convert_pbkd_function
            Y2Storage::PbkdFunction.find(encrypt_json[:pbkdFunction])
          end
        end
      end
    end
  end
end
