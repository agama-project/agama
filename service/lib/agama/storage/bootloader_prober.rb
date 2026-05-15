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

require "agama/storage/bootloader"
require "yast"
require "y2storage"

Yast.import "Arch"

module Agama
  module Storage
    # Class for probing bootloaders available in the system.
    class BootloaderProber
      # @return [Array<Bootloader>]
      def probe
        grub2 = Bootloader.new(Y2Storage::BootloaderType::GRUB2, tpm: grub2_tpm?)
        return [grub2] if raspberry_pi? || !(arch.x86? || Yast::Arch.aarch64)

        tpm = bls_tpm?
        grub2_bls = Bootloader.new(Y2Storage::BootloaderType::GRUB2_BLS, tpm: tpm)
        systemd_boot = Bootloader.new(Y2Storage::BootloaderType::SYSTEMD_BOOT, tpm: tpm)
        [grub2, grub2_bls, systemd_boot]
      end

    private

      # Whether TPM is usable for grub2.
      #
      # @return [Boolean]
      def grub2_tpm?
        Y2Storage::EncryptionMethod::TPM_FDE.possible?
      end

      # Whether TPM is usable for a BLS bootloader.
      #
      # @return [Boolean]
      def bls_tpm?
        Y2Storage::EncryptionMethod::TPM_BLS.possible?
      end

      # FIXME: This method is duplicated at Y2Storage::Proposal::BootPlanner and also in
      #   yast-storage-ng.
      #
      # Whether the system is a Raspberry Pi.
      #
      # @return [Boolean]
      def raspberry_pi?
        return @raspberry_pi unless @raspberry_pi.nil?

        vendor_model_path = "/proc/device-tree/model"

        @raspberry_pi = Yast::Arch.aarch64 &&
          File.exist?(vendor_model_path) &&
          File.read(vendor_model_path).match?(/Raspberry Pi/i)
      end

      def arch
        Y2Storage::StorageManager.instance.arch
      end
    end
  end
end
