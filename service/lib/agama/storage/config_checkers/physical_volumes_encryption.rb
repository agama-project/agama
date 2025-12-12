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

require "agama/storage/config_checkers/encryption"
require "yast/i18n"
require "y2storage/encryption_method"

module Agama
  module Storage
    module ConfigCheckers
      # Class for checking the physical volumes encryption config.
      class PhysicalVolumesEncryption < Encryption
        include Yast::I18n

        # @param config [Configs::VolumeGroup]
        def initialize(config)
          super

          textdomain "agama"
        end

      private

        # @return [Configs::VolumeGroup]
        attr_reader :config

        # @return [Configs::Encryption, nil]
        def encryption
          config.physical_volumes_encryption
        end

        # @see Encryption#issues
        #
        # @return [Issue, nil]
        def wrong_method_issue
          method = encryption.method
          return if method.nil? || valid_method?(method)

          error(
            format(
              # TRANSLATORS: 'method' is the identifier of the method to encrypt the device
              #   (e.g., 'luks1').
              _("'%{method}' is not a suitable method to encrypt the physical volumes."),
              method: method.to_human_string
            ),
            kind: IssueClasses::Config::WRONG_ENCRYPTION_METHOD
          )
        end

        # Whether an encryption method can be used for encrypting physical volumes.
        #
        # @param method [Y2Storage::EncryptionMethod]
        # @return [Boolean]
        def valid_method?(method)
          valid_methods = [
            Y2Storage::EncryptionMethod::LUKS1,
            Y2Storage::EncryptionMethod::LUKS2,
            Y2Storage::EncryptionMethod::PERVASIVE_LUKS2,
            Y2Storage::EncryptionMethod::TPM_FDE
          ]

          valid_methods.include?(method)
        end
      end
    end
  end
end
