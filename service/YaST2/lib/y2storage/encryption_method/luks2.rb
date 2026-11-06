# Copyright (c) [2021] SUSE LLC
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

require "y2storage/storage_env"
require "y2storage/encryption_method/base"
require "y2storage/encryption_method/pervasive_luks2"
require "y2storage/encryption_processes/luks"
require "y2storage/pbkd_function"

Yast.import "Mode"

module Y2Storage
  module EncryptionMethod
    # The encryption method that allows to create and identify an encrypted device using regular
    # LUKS2 (with no pervasive encryption or any other advanced method)
    class Luks2 < Base
      # Constructor, see {Base}
      def initialize
        textdomain "storage"
        super(:luks2, _("Regular LUKS2"))
      end

      # Whether the process was used for the given encryption device
      #
      # @param encryption [Y2Storage::Encryption] the encryption device to check
      # @return [Boolean] true when the encryption type is LUKS2; false otherwise
      def used_for?(encryption)
        # Maybe we could check if this uses the default cipher for LUKS (which is always
        # aes-xts-plain64) or check with a given list of known ciphers. For the time being, let's
        # discard only the ones with the PervasiveLuks cipher.
        encryption.type.is?(:luks2) && encryption.cipher != PervasiveLuks2.cipher
      end

      # Creates an encryption device for the given block device
      #
      # @param blk_device [Y2Storage::BlkDevice]
      # @param dm_name [String]
      # @param pbkdf [PbkdFunction, nil] password-based key derivation function to be used by the created
      #   LUKS2 device
      # @param label [String] optional LUKS label
      #
      # @return [Y2Storage::Encryption]
      def create_device(blk_device, dm_name, pbkdf: nil, label: "")
        encryption_process.create_device(blk_device, dm_name, pbkdf: pbkdf, label: label)
      end

      private

      # @see Base#encryption_process
      def encryption_process
        EncryptionProcesses::Luks.new(self, :luks2)
      end
    end
  end
end
