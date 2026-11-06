# Copyright (c) [2019-2025] SUSE LLC
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
require "y2storage/encryption_processes/pervasive"
require "y2storage/encryption_processes/secure_key"

module Y2Storage
  module EncryptionMethod
    # Encryption method that allows to create and identify a volume encrypted
    # with Pervasive Encryption.
    class PervasiveLuks2 < Base
      # Cipher used for pervasive encryption
      CIPHER = "paes-xts-plain64".freeze
      private_constant :CIPHER

      # Cipher used for pervasive encryption
      #
      # @return [String]
      def self.cipher
        CIPHER.dup
      end

      def initialize
        textdomain "storage"

        super(:pervasive_luks2, _("Pervasive Volume Encryption"))
      end

      # @see Base#used_for?
      def used_for?(encryption)
        encryption.type.is?(:luks2) && encryption.cipher == CIPHER
      end

      # @see Base#available?
      def available?
        EncryptionProcesses::SecureKey.available?
      end

      # Creates an encryption device for the given block device
      #
      # @param blk_device [Y2Storage::BlkDevice]
      # @param dm_name [String]
      # @param apqns [Array<EncryptionProcesses::Apqn>] APQNs to use when generating a secure key.
      # @param key_type [String] Type of the generated secure key, as accepted by the command
      #   "zkey generate"
      #
      # @return [Y2Storage::Encryption]
      def create_device(blk_device, dm_name, apqns: [], key_type: nil)
        encryption_process.create_device(blk_device, dm_name, apqns: apqns, key_type: key_type)
      end

      private

      # @see Base#encryption_process
      def encryption_process
        EncryptionProcesses::Pervasive.new(self)
      end
    end
  end
end
