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
# Copyright (c) [2019] SUSE LLC

require "yast"
require "y2storage/encryption_method/base"
require "y2storage/yast_feature"
require "y2storage/encryption_processes/tpm_fde_tools"

Yast.import "Mode"
Yast.import "Package"

module Y2Storage
  module EncryptionMethod
    # Encryption method that allows to encrypt a device using LUKS2 and configure the unlocking
    # process via the system TPM using the fde-tools created by SUSE.
    #
    # This is a quite special encryption method due to the way the fde-tools work. First of all,
    # if this method is used, it must be used at least for the root (/) filesystem and only
    # additionally for some other devices.
    #
    # Check the documentation of fde-tools for further information.
    # https://github.com/openSUSE/fde-tools
    class TpmFde < Base
      def initialize
        textdomain "storage"

        super(:tpm_fde, _("TPM-Based Full Disk Encrytion"))
      end

      # @see Base#used_for?
      #
      # @todo Not sure if this would be possible at the end, since the exact way to setup the
      # system using fde-tools is still changing too often. In any case, having a precise result
      # for this method will only be relevant when implementing support for creating encrypted
      # devices in an installed system. During installation returning always false is perfectly
      # correct.
      #
      # @return [Boolean] false
      def used_for?(_encryption)
        # One candidate criteria (still waiting for some conversations with fde-toold developers)
        # could be:
        # encryption.type.is?(:luks2) && key_file == EncryptionProcesses::TpmFdeTools.key_file_name
        false
      end

      # @see Base#available?
      #
      # In this initial implementation this always returns false because there are important
      # limitations to use this in (Auto)YaST:
      #
      # - The current version of the inst-sys cannot talk to the TPM
      # - There is still no corresponding UI in the Expert Partitioner
      # - Some mechanism to ensure consistency (eg. checking all devices use the same recovery
      #   password) need to be introduced
      # - The current implementation of the encryption method only covers system installation
      #   (with no support to add a new encrypted device to a system already using fde-tools)
      #
      # So far, the encryption method is implemented to be used by Agama (which doesn't honor
      # the {#available?} method.
      #
      # @return [Boolean] false
      def available?
        false
      end

      # Whether the target system meets the requisites to setup devices using this
      # encryption method.
      #
      # The encryption method must be used at least for the root filesystem (eg. is not possible to
      # use it for /var but not for /), but that can't hardly be controlled here. A separate
      # validation that considers the whole devicegraph is needed.
      #
      # @return [Boolean]
      def possible?
        Y2Storage::Arch.new.efiboot? && tpm_present?
      end

      # Creates an encryption device for the given block device
      #
      # @param blk_device [Y2Storage::BlkDevice]
      # @param dm_name [String]
      #
      # @return [Y2Storage::Encryption]
      def create_device(blk_device, dm_name, label: "")
        encryption_process.create_device(blk_device, dm_name, label: label)
      end

      private

      # @see Base#encryption_process
      def encryption_process
        EncryptionProcesses::TpmFdeTools.new(self)
      end

      # Whether a TPM2 chip is present and working
      #
      # @see #possible?
      #
      # @return [Boolean]
      def tpm_present?
        return @tpm_present unless @tpm_present.nil?

        @tpm_present = EncryptionProcesses::FdeTools.new.tpm_present?
      end
    end
  end
end
