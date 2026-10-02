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

require "y2storage/encryption_type"
require "y2storage/encryption_processes/base"

module Y2Storage
  module EncryptionProcesses
    # The encryption process that allows to create and identify an encrypted
    # device using LUKS2 and added TPM/FIDO support.
    class SystemdFde < Base
      # Creates an encryption layer over the given block device
      #
      # @param blk_device [Y2Storage::BlkDevice]
      # @param dm_name [String]
      # @param authentication [EncryptionAuthentication] authentications for the crypted device
      # @param pbkdf [PbkdFunction, nil] PBKDF of the LUKS device, only relevant for LUKS2
      # @param label [String, nil] label of the LUKS device, only relevant for LUKS2
      #
      # @return [Encryption]
      def create_device(blk_device, dm_name, authentication, pbkdf: nil, label: nil)
        enc = super(blk_device, dm_name)
        enc.label = label if label
        enc.pbkdf = pbkdf if pbkdf
        enc.authentication = authentication
        enc
      end

      # @see EncryptionProcesses::Base#encryption_type
      def encryption_type
        EncryptionType::LUKS2
      end
    end
  end
end
