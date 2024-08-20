# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
require "y2storage/encryption_method"

module Agama
  module Storage
    # Settings regarding encryption for the Agama storage proposal
    class EncryptionSettings
      include Y2Storage::SecretAttributes

      # @see .encryption_methods
      METHODS = [
        Y2Storage::EncryptionMethod::LUKS2,
        Y2Storage::EncryptionMethod::TPM_FDE
      ].freeze
      private_constant :METHODS

      # @!attribute password
      #   Password to use when creating new encryption devices
      #   @return [String, nil] nil if undetermined
      secret_attr :password

      # @return [Y2Storage::EncryptionMethod::Base]
      attr_accessor :method

      # PBKD function to use for LUKS2
      #
      # @return [Y2Storage::PbkdFunction, nil] Can be nil if using LUKS1.
      attr_accessor :pbkd_function

      # All known encryption methods
      #
      # This includes all the potentially accepted methods, no matter whether they are
      # possible for the current system and product.
      #
      # @return [Array<Y2Storage::EncryptionMethod::Base>]
      def self.encryption_methods
        METHODS
      end

      # All methods that can be used to calculate a proposal for the current system and product
      #
      # @return [Array<Y2Storage::EncryptionMethod::Base>]
      def self.available_methods
        encryption_methods.reject { |m| m.respond_to?(:possible?) && !m.possible? }
      end

      # Constructor
      def initialize
        # LUKS2 with PBKDF2 is the most sensible option nowadays:
        #  - LUKS2 offers additional features over LUKS1
        #  - PBKDF2 keeps memory usage similar to LUKS1 and is supported by Grub2
        @method = Y2Storage::EncryptionMethod::LUKS2
        @pbkd_function = Y2Storage::PbkdFunction::PBKDF2
      end

      # Whether the proposal must create encrypted devices
      #
      # @return [Boolean]
      def encrypt?
        !(password.nil? || password.empty?)
      end
    end
  end
end
