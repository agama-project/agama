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

require "agama/storage/config_conversions/to_json_conversions/base"
require "agama/storage/config_conversions/to_json_conversions/encryption_properties"
require "agama/storage/configs/encryption"

module Agama
  module Storage
    module ConfigConversions
      module ToJSONConversions
        # Encryption conversion to JSON hash according to schema.
        class Encryption < Base
          # @see Base
          def self.config_type
            Configs::Encryption
          end

          # @see Base#convert
          # @return [Hash, String, nil]
          def convert
            return unless config.method

            super || convert_swap_encryption
          end

        private

          # @see Base#conversions
          def conversions
            method = config.method

            if method.is?(:luks1)
              luks1_conversions
            elsif method.is?(:luks2)
              luks2_conversions
            elsif method.is?(:pervasive_luks2)
              pervasive_luks2_conversions
            elsif method.is?(:tpm_fde)
              tpm_fde_conversions
            else
              {}
            end
          end

          # @return [Hash]
          def luks1_conversions
            { luks1: convert_encryption_properties }
          end

          # @return [Hash]
          def luks2_conversions
            { luks2: convert_encryption_properties }
          end

          # @return [Hash]
          def pervasive_luks2_conversions
            { pervasiveLuks2: convert_encryption_properties }
          end

          # @return [Hash]
          def tpm_fde_conversions
            { tpmFde: convert_encryption_properties }
          end

          # @return [Hash, nil]
          def convert_encryption_properties
            ToJSONConversions::EncryptionProperties.new(config).convert
          end

          # @return [String]
          def convert_swap_encryption
            config.method.id.to_s
          end
        end
      end
    end
  end
end
