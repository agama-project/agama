# Copyright (c) [2015-2017] SUSE LLC
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

require "yast"
require "y2storage/secret_attributes"
require "y2storage/encryption"

module Y2Storage
  module Planned
    # Mixin for planned devices that can have an encryption layer on top.
    # @see Planned::Device
    module CanBeEncrypted
      include SecretAttributes

      # This value matches Storage::Luks.v1_metadata_size, which is not exposed in
      # the libstorage API
      LUKS1_OVERHEAD = DiskSize.MiB(2)
      private_constant :LUKS1_OVERHEAD

      # This value matches Storage::Luks.v2_metadata_size, see above
      LUKS2_OVERHEAD = DiskSize.MiB(16)
      private_constant :LUKS2_OVERHEAD

      # @!attribute encryption_method
      #   @return [EncryptionMethod::Base, nil] method used to encrypt the device. If is nil,
      #     it means the device will not be encrypted
      attr_accessor :encryption_method

      # @!attribute encryption_authentication
      #   @return [EncryptionAuthentication] encryption authentication type
      attr_accessor :encryption_authentication

      # @!attribute encryption_password
      #   @return [String, nil] password used to encrypt the device.
      secret_attr :encryption_password

      # PBKDF to use when encrypting the device if such property makes sense (eg. LUKS2)
      #
      # @return [PbkdFunction, nil] nil to use the default derivation function
      attr_accessor :encryption_pbkdf

      # LUKS label to use for the device if labels are supported (eg. LUKS2)
      #
      # @return [String, nil] nil or empty string to not set any label
      attr_accessor :encryption_label

      # Cipher to use when encrypting a LUKS device
      #
      # @return [String, nil] nil or empty string to use the default cipher
      attr_accessor :encryption_cipher

      # Selected APQNs to generate a new security key for pervasive encryption
      #
      # @return [Array<String>]
      attr_accessor :encryption_pervasive_apqns

      # Pervasive key key_type
      #
      # @return [String, nil] nil or empty string to use the default key type
      attr_accessor :encryption_pervasive_key_type

      # Key size (in bits) to use when encrypting a LUKS device
      #
      # Any positive value must be a multiple of 8.
      #
      # Note this uses bits since that's the standard unit for the key size in LUKS and is
      # also the unit used by cryptsetup for all its inputs and outputs.
      #
      # Under the hood, this is translated to bytes because that's what libstorage-ng uses.
      #
      # @return [Integer, nil] nil or zero to use the default size
      attr_accessor :encryption_key_size

      # Initializations of the mixin, to be called from the class constructor.
      def initialize_can_be_encrypted
        self.encryption_pervasive_apqns = []
      end

      # Checks whether the resulting device must be encrypted
      #
      # @return [Boolean]
      def encrypt?
        !!(encryption_method || encryption_password)
      end

      # Determines whether the device can be ciphered using the given encryption method
      #
      # @param method [EncryptionMethod] Encryption method
      # @return [Boolean]
      def supported_encryption_method?(method)
        !method.only_for_swap? || swap?
      end

      # Returns the (possibly encrypted) device to be used for the planned
      # device.
      #
      # If encryption is requested by the planned device, the method will
      # encrypt the plain device and will return the corresponding encrypted
      # one. Otherwise, it will simply return the plain device.
      #
      # FIXME: temporary API. It should be improved.
      #
      # @param plain_device [BlkDevice]
      # @return [BlkDevice]
      def final_device!(plain_device)
        result = super
        if create_encryption?
          method = encryption_method || EncryptionMethod.find(:luks1)
          args = {}
          # FIXME: For pervasive_luks2 the arguments need to be passed directly at #encrypt
          # instead of being able to assign them afterwards. That's a defect on the API of
          # that encryption method that should be fixed
          if method.is?(:pervasive_luks2)
            args[:apqns] = encryption_pervasive_apqns
            args[:key_type] = encryption_pervasive_key_type
          end
          plain_device.remove_descendants
          result = plain_device.encrypt(method: method, password: encryption_password, **args)
          assign_enc_attr(result, :pbkdf)
          assign_enc_attr(result, :label)
          assign_enc_attr(result, :cipher)
          assign_enc_attr(result, :authentication)
          assign_enc_attr(result, :key_size) { |value| value / 8 }
          log.info "Device encrypted. Returning the new device #{result.inspect}"
        else
          log.info "No need to encrypt. Returning the existing device #{result.inspect}"
        end

        result
      end

      def self.included(base)
        base.extend(ClassMethods)
      end

      protected

      def create_encryption?
        return false unless encrypt?
        return true unless reuse?
        return reformat? if respond_to?(:reformat?)

        false
      end

      # Assigns the corresponding attribute to the encryption object if it makes sense
      #
      # @see #final_device!
      #
      # A block can be passed to transform the value of the attribute
      #
      # @param encryption [Encryption]
      # @param attr [Symbol, String]
      def assign_enc_attr(encryption, attr)
        value = send(:"encryption_#{attr}")
        return if value.nil?

        return unless encryption.send(:"supports_#{attr}?")

        value = yield(value) if block_given?
        encryption.send(:"#{attr}=", value)
      end

      # Class methods for the mixin
      module ClassMethods
        # Space that will be used by the encryption data structures in a device.
        # I.e. how much smaller will be an encrypted device compared to the plain
        # one.
        #
        # @param type [EncryptionType]
        # @return [DiskSize]
        def encryption_overhead(type = EncryptionType::LUKS1)
          return LUKS1_OVERHEAD if type&.is?(:luks1)
          return LUKS2_OVERHEAD if type&.is?(:luks2)

          DiskSize.zero
        end
      end
    end
  end
end
