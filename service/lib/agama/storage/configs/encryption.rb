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

require "y2storage/secret_attributes"

module Agama
  module Storage
    module Configs
      # Configuration setting describing the desired encryption for a device
      class Encryption
        include Y2Storage::SecretAttributes

        # @return [Y2Storage::EncryptionMethod::Base, nil]
        attr_accessor :method

        # @!attribute password
        #   Password to use if the encryption method requires one
        #   @return [String, nil] nil if undetermined or not needed
        secret_attr :password

        # PBKD function to use for LUKS2
        #
        # @return [Y2Storage::PbkdFunction, nil] Can be nil for methods that are not LUKS2
        attr_accessor :pbkd_function

        # Optional LUKS2 label
        #
        # @return [String, nil]
        attr_accessor :label

        # Optional cipher if LUKS is going to be used
        #
        # @return [String, nil]
        attr_accessor :cipher

        # Specific key size (in bits) if LUKS is going to be used
        #
        # @return [Integer, nil] If nil, the default key size will be used. If an integer
        #     value is used, it has to be a multiple of 8
        attr_accessor :key_size

        # Whether the password is missing.
        #
        # @return [Boolean]
        def missing_password?
          return false unless method&.password_required?

          password.nil? || password.empty?
        end
      end
    end
  end
end
