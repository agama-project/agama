# Copyright (c) [2019] SUSE LLC
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

require "y2storage/encryption_processes/base"
require "y2storage/encryption_type"

module Y2Storage
  module EncryptionProcesses
    # Base class for encryption processes that use an ephemeral password to encrypt a swap device
    #
    # Swap based methods use plain encryption technology to encrypt the swap device with a new
    # password generated at boot time. Generally, the new password is generated based on
    # /dev/urandom data (see {EncryptionMethod::RandomSwap}), but IBM offers other mechanisms for z
    # Systems (see {EncryptionMethod::ProtectedSwap} and {EncryptionMethod::SecureSwap} processes).
    class Volatile < Base
      SWAP_OPTION = "swap".freeze
      private_constant :SWAP_OPTION

      attr_reader :key_file
      attr_reader :cipher
      attr_reader :key_size

      # Constructor
      #
      # @param key_file [String]         Path to the key file
      # @param cipher   [String,nil]     Cipher type
      # @param key_size [Integer,nil]    Key size
      def initialize(method, key_file: nil, cipher: nil, key_size: nil)
        super(method)
        @key_file = key_file
        @cipher = cipher
        @key_size = key_size
      end

      # @see Base#create_device
      def create_device(blk_device, dm_name)
        enc = super
        enc.key_file = key_file if key_file
        enc
      end

      def encryption_type
        EncryptionType::PLAIN
      end

      # Encryption options to add to the encryption device (crypttab options)
      #
      # @param blk_device [BlkDevice] Block device to encrypt
      # @return [Array<String>]
      def crypt_options(blk_device)
        [swap_option, cipher_option, key_size_option, sector_size_option(blk_device)].compact
      end

      # Encryption options to open the encryption device
      #
      # @param blk_device [BlkDevice] Block device to encrypt
      # @return [Array<String>]
      def open_options(blk_device)
        [cipher_open_option, key_size_open_option, sector_size_open_option(blk_device)].compact
      end

      # Wheter a specific cipher is used
      #
      # @return [Boolean]
      def cipher?
        !cipher.nil?
      end

      # Whether a specific key size is used
      #
      # @return [Boolean]
      def key_size?
        !key_size.nil?
      end

      private

      # Swap option for the crypttab file
      #
      # @return [String]
      def swap_option
        SWAP_OPTION
      end

      # Cipher option for the crypttab file
      #
      # @return [String, nil] nil if no specific cipher
      def cipher_option
        return nil unless cipher?

        "cipher=#{cipher}"
      end

      # Key size option for the crypttab file
      #
      # @return [String, nil] nil if no specific size
      def key_size_option
        return nil unless key_size?

        "size=#{key_size}"
      end

      # Cipher option to open the encryption device
      #
      # @return [String, nil] nil if no specific cipher
      def cipher_open_option
        return nil unless cipher?

        "--cipher '#{cipher}'"
      end

      # Key size option to open the encryption device
      #
      # @return [String, nil] nil if no specific size
      def key_size_open_option
        return nil unless key_size?

        "--key-size '#{key_size}'"
      end

      # Sector size option for the encryption
      #
      # @param blk_device [BlkDevice] Block device to encrypt
      # @return [String, nil] nil if no specific sector size
      def sector_size_option(blk_device)
        sector_size = sector_size_for(blk_device)
        return nil unless sector_size

        "sector-size=#{sector_size}"
      end

      # Sector size option to open the encryption device
      #
      # @param blk_device [BlkDevice] Block device to encrypt
      # @return [String, nil] nil if no specific sector size
      def sector_size_open_option(blk_device)
        sector_size = sector_size_for(blk_device)
        return nil unless sector_size

        "--sector-size '#{sector_size}'"
      end
    end
  end
end
