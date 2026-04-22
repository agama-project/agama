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

require "agama/storage/bootloaders"
require "y2storage/storage_manager"
require "y2storage/encryption_processes/fde_tools"
require "yast"

Yast.import "Arch"

module Agama
  module Storage
    # Class for probing bootloaders available in the system.
    class BootloaderProber
      # @return [Array<Bootloaders::Base>]
      def probe
        grub2 = Bootloaders::Grub2.new(tpm: grub2_tpm?)

        return [grub2] if raspberry_pi? || arch.s390? || arch.ppc?

        if arch.x86? || Yast::Arch.aarch64
          tpm = bls_tpm?
          grub2_bls = Bootloaders::Grub2BLS.new(tpm: tpm)
          systemd_boot = Bootloaders::SystemdBoot.new(tpm: tpm)

          return [grub2, grub2_bls, systemd_boot]
        end

        []
      end

    private

      # Whether TPM is usable for grub2.
      #
      # @return [Boolean]
      def grub2_tpm?
        arch.efiboot? && Y2Storage::EncryptionProcesses::FdeTools.new.tpm_present?
      end

      # Whether TPM is usable for a BLS bootloader.
      #
      # @return [Boolean]
      def bls_tpm?
        arch.efiboot? && Yast::Arch.has_tpm2
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
