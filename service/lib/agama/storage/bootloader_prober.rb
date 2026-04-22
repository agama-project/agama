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

require "y2storage/storage_manager"
require "yast"

Yast.import "BootStorage"
Yast.import "Arch"

module Agama
  module Storage
    # Class for probing bootloaders available in the system.
    class BootloaderProber
      module Bootloader
        GRUB2 = :grub2
        GRUB2_BLS = :grub2_bls
        SYSTEMD_BOOT = :systemd_boot
      end

      module EncryptionAuthMethod
        PASSWORD = :password
        TPM = :tpm
      end

      def probe
        probe_bootloaders
        probe_grub2_tpm
        probe_bls_tpm
      end

      def bootloaders
        @bootloaders || []
      end

      def encryption_auth_methods(bootloader)
        return grub2_encryption_auth_methods if bootloader == Bootloader::GRUB2

        return bls_encryption_auth_methods if bls_bootloader?(bootloader)

        []
      end

    private

      def probe_bootloaders
        @bootloaders =
          if raspberry_pi? || arch.s390? || arch.ppc?
            [Bootloader::GRUB2]
          elsif arch.x86? || Yast::Arch.aarch64
            [Bootloader::GRUB2, Bootloader::GRUB2_BLS, Bootloader::SYSTEMD_BOOT]
          end
      end

      def probe_grub2_tpm
        @grup2_tpm = arch.efiboot? && EncryptionProcesses::FdeTools.new.tpm_present?
      end

      def probe_bls_tpm
        @bls_tpm = arch.efiboot? && Yast::Arch.has_tpm2
      end

      def grub2_encryption_auth_methods
        methods = [EncryptionAuthMethod::PASSWORD]
        methods << EncryptionAuthMethod::TPM if grub2_tpm?
        methods
      end

      def bls_encryption_auth_methods
        methods = [EncryptionAuthMethod::PASSWORD]
        methods << EncryptionAuthMethod::TPM if bls_tpm?
        methods
      end

      def bls_bootloader?(bootloader)
        [Bootloader::GRUB2_BLS, Bootloader::SYSTEMD_BOOT].includes?(bootloader)
      end

      def grub2_tpm?
        !!@grup2_tpm
      end

      def bls_tpm?
        !!@bls_tpm
      end

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
