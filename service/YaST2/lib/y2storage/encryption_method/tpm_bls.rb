# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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
require "y2storage/encryption_processes/sdboot"
require "y2storage/tpm"
require "yast"
require "yast2/execute"

module Y2Storage
  module EncryptionMethod
    # BLS compliant encryption method that allows to encrypt a device using LUKS2 and configure the
    # unlocking process via the system TPM.
    class TpmBls < Base
      include Yast

      def initialize
        textdomain "storage"

        super(:tpm_bls, _("BLS Compliant Encryption With TPM Unlocking"))
      end

      # @see Base#available?
      #
      # So far, the encryption method is implemented to be used only by Agama (which doesn't honor
      # the {#available?} method). Probably this method will replace SystemdFde used by YaST.
      #
      # @return [Boolean]
      def available?
        false
      end

      # Whether the target system meets the requisites to setup devices using this encryption
      # method.
      #
      # @return [Boolean]
      def possible?
        arch.efiboot? && tpm.policy_authorize_nv?
      end

      # Creates an encryption device for the given block device.
      #
      # @param blk_device [Y2Storage::BlkDevice]
      # @param dm_name [String]
      # @param pbkdf [PbkdFunction, nil] Password-based key derivation function to be used by the
      #   created LUKS2 device.
      # @param label [String] optional LUKS2 label.
      #
      # @return [Y2Storage::Encryption]
      def create_device(blk_device, dm_name, pbkdf: nil, label: "")
        encryption_process.create_device(blk_device, dm_name, pbkdf: pbkdf, label: label)
      end

      private

      # @see Base#encryption_process
      # @return [EncryptionProcesses::Sdboot]
      def encryption_process
        EncryptionProcesses::Sdboot.new(self)
      end

      # @return [Y2Storage::Arch]
      def arch
        StorageManager.instance.arch
      end

      # @return [Y2Storage::Tpm]
      def tpm
        Tpm.instance
      end
    end
  end
end
