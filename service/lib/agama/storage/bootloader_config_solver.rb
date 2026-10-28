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

require "agama/cmdline_args"
require "bootloader/systeminfo"
require "yast"
require "y2storage"

module Agama
  module Storage
    # Class for solving a bootloader storage config.
    #
    # Solving a config means to assign proper values according to the product and the system.
    # That is analogous to the equivalent process described for the storage config at
    # doc/storage_proposal_from_profile.md.
    class BootloaderConfigSolver
      # @param product_config [Agama::Config] configuration of the product to install
      def initialize(product_config)
        @product_config = product_config
      end

      # Solves the config according to the product and the system.
      #
      # @note The config object is modified.
      #
      # @param config [BootloaderConfig]
      def solve(config)
        return if config.type

        config.type =
          if bls_compliant_system?
            kernel_bls_type || product_bls_type || DEFAULT_BLS_TYPE
          else
            DEFAULT_TYPE
          end
      end

    private

      # @return [Agama::Config]
      attr_reader :product_config

      # Default bootloader type for most scenarios
      DEFAULT_TYPE = Y2Storage::BootloaderType::GRUB2
      private_constant :DEFAULT_TYPE

      # Default bootloader type for systems in which a BLS-compliant bootloader is supported
      # TODO: change this to SYSTEMD_BOOT when we have sorted everthing out (encryption with TPM,
      # dual-booting, etc.).
      DEFAULT_BLS_TYPE = Y2Storage::BootloaderType::GRUB2
      private_constant :DEFAULT_BLS_TYPE

      # Archs in which a BLS-compliant bootloader is supported
      BLS_ARCHS = [:x86_64, :i386, :aarch64, :arm, :riscv64].freeze
      private_constant :BLS_ARCHS

      # Whether the usage of a BLS-compliant bootloader is supported
      #
      # @return [Boolean]
      def bls_compliant_system?
        return false unless ::Bootloader::Systeminfo.efi?

        BLS_ARCHS.any? { |a| Yast::Arch.public_send(a) }
      end

      # @return [Y2Storage::BootloaderType, nil]
      def product_bls_type
        Y2Storage::BootloaderType.find(product_config.data.dig("boot", "default_efi_bootloader"))
      end

      # Bootloader type indicated in the kernel options.
      #
      # This is only used for the systemd-boot preview and will be dropped once the config allows
      # changing the bootloader
      #
      # @return [Y2Storage::BootloaderType, nil] nil if "systemd_boot_preview" kernel option is
      #   not set.
      def kernel_bls_type
        arg_value = kernel_args.data["systemd_boot_preview"]

        return unless arg_value == "1"

        Y2Storage::BootloaderType::SYSTEMD_BOOT
      end

      # Kernel arguments.
      #
      # The class {CmdlineArgs} is still used here because it is only needed for the systemd-boot
      #   preview. This will be dropped once the config allows changing the bootloader.
      def kernel_args
        @kernel_args ||= CmdlineArgs.read_from_kernel
      end
    end
  end
end
