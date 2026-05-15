# frozen_string_literal: true

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

require "agama/storage/config_conversions/from_model_conversions/base"
require "y2storage/encryption_method"

module Agama
  module Storage
    module ConfigConversions
      module FromModelConversions
        # Encryption conversion from model according to the JSON schema.
        class Encryption < Base
          # @param model_json [Hash]
          # @param bootloader_config [Storage::BootloaderConfig]
          def initialize(model_json, bootloader_config)
            super(model_json)
            @bootloader_config = bootloader_config
          end

        private

          # @return [Storage::BootloaderConfig]
          attr_reader :bootloader_config

          # @see Base
          # @return [Configs::Encryption]
          def default_config
            Configs::Encryption.new
          end

          # @see Base#conversions
          # @return [Hash]
          def conversions
            {
              method:   convert_method,
              password: model_json[:password]
            }
          end

          # @return [Y2Storage::EncryptionMethod::Base]
          def convert_method
            tpm = model_json[:tpm] || false
            bootloader_type = bootloader_config.type

            if tpm && bootloader_type&.bls?
              Y2Storage::EncryptionMethod::TPM_BLS
            elsif tpm
              Y2Storage::EncryptionMethod::TPM_FDE
            else
              Y2Storage::EncryptionMethod::LUKS2
            end
          end
        end
      end
    end
  end
end
