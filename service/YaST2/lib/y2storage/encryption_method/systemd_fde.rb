# Copyright (c) [2025] SUSE LLC
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
# Copyright (c) [2019] SUSE LLC

require "yast"
require "y2storage/encryption_method/base"
require "y2storage/encryption_processes/systemd_fde"
require "y2storage/pbkd_function"
require "y2storage/yast_feature"
require "y2storage/arch"

Yast.import "Mode"
Yast.import "Package"
Yast.import "Arch"

module Y2Storage
  module EncryptionMethod
    # Encryption method that allows to encrypt a device using LUKS2 and configure the unlocking
    # process via the system TPM or FIDO2 using the sdbootutil created by SUSE.
    #
    # Check the documentation of sdbootutil for further information.
    # https://github.com/openSUSE/sdbootutil
    class SystemdFde < Base
      def initialize
        textdomain "storage"

        super(:systemd_fde, _("Systemd-Based Full Disk Encryption"))
      end

      # @see Base#used_for?
      #
      # This method will only be relevant when implementing support for creating encrypted
      # devices in an installed system, which is currently not supported.
      # During installation returning always false is perfectly correct.
      #
      # @return [Boolean] false
      def used_for?(_encryption)
        false
      end

      # Whether the encryption method can be used in this system
      #
      # @return [Boolean]
      def available?
        Y2Storage::Arch.new.efiboot?
      end

      # Creates an encryption device for the given block device
      #
      # @param blk_device [Y2Storage::BlkDevice]
      # @param dm_name [String]
      # @param authentication [EncryptionAuthentication] authentications for the crypted device
      # @param pbkdf [PbkdFunction, nil] password-based key derivation function to be used by the created
      #   LUKS2 device
      # @param label [String] optional LUKS label
      #
      # @return [Y2Storage::Encryption]
      def create_device(blk_device, dm_name, authentication: nil, pbkdf: nil, label: "")
        encryption_process.create_device(blk_device, dm_name, authentication,
          pbkdf: pbkdf, label: label)
      end

      private

      # @see Base#encryption_process
      def encryption_process
        EncryptionProcesses::SystemdFde.new(self)
      end
    end
  end
end
