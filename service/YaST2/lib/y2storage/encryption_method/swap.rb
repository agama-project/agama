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

require "y2storage/encryption_method/base"
require "y2storage/encryption_processes/volatile"

module Y2Storage
  module EncryptionMethod
    # Base class for swap encryption methods.
    #
    # Note that system hibernation does not work when using a volatile key for encrypting a swap device
    # (see {RandomSwap}, {ProtectedSwap} and {SecureSwap}). For these encryption methods, the swap is
    # re-encrypted during the boot process and its previous content is lost.
    #
    # The system does not prevent hibernation when using a volatile key. To prevent hibernation,
    # 'hibernate' target must be masked (i.e., systemctl mask hibernate.target).
    #
    # YaST does not offer any mechanism to prevent hibernation either. If a swap encryption method is
    # used, the user is responsible of configuring the system to avoid hibernation (as suggested in the
    # help of the encryption dialog). In case YaST will offer any way to disable hibernation, make sure
    # to also offer an option to enable it again easily.
    class Swap < Base
      # @see Base#used_for?
      def used_for?(encryption)
        used?(encryption.key_file, encryption.crypt_options)
      end

      # @see Base#used_for_crypttab?
      def used_for_crypttab?(entry)
        used?(entry.password, entry.crypt_options)
      end

      # @see Base#only_for_swap?
      def only_for_swap?
        true
      end

      # @see Base#exist?
      def available?
        File.exist?(key_file)
      end

      # @see Base#password_required?
      def password_required?
        false
      end

      # Encryption key file
      #
      # Each Swap process could use a different key file.
      #
      # @raise [RuntimeError] if no key file has been defined.
      #
      # @return [String]
      def key_file
        raise "Not defined key file" unless self.class.const_defined?(:KEY_FILE)

        self.class.const_get(:KEY_FILE)
      end

      # Encryption cipher
      #
      # Each Swap process could use a different cipher.
      #
      # @return [String, nil] nil if no specific cipher
      def cipher
        self.class.const_get(:CIPHER) if self.class.const_defined?(:CIPHER)
      end

      # Size of the encryption key
      #
      # @return [String, nil] nil if no specific size
      def key_size
        self.class.const_get(:KEY_SIZE) if self.class.const_defined?(:KEY_SIZE)
      end

      private

      SWAP_OPTION = "swap".freeze

      # Checks whether the process was used according to the given key file and encryption options
      #
      # @param key_file [String]
      # @param crypt_options [Array<String>]
      def used?(key_file, crypt_options)
        contain_swap_option?(crypt_options) && use_key_file?(key_file)
      end

      # Whether the given encryption device contains the swap option
      #
      # @param crypt_options [Array<String>]
      # @return [Boolean]
      def contain_swap_option?(crypt_options)
        crypt_options.any? { |o| o.casecmp?(SWAP_OPTION) }
      end

      # Whether the given encryption device is using the key file for this process
      #
      # @param key_file [String]
      # @return [Boolean]
      def use_key_file?(key_file)
        key_file == self.key_file
      end

      # @see Base#encryption_process
      def encryption_process
        EncryptionProcesses::Volatile.new(
          self, key_file: key_file, cipher: cipher, key_size: key_size
        )
      end
    end
  end
end
