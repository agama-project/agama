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

require "agama/storage/bootloader_type"
require "yast"
require "bootloader/systeminfo"

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
          if bls?
            product_bls_type || DEFAULT_BLS_TYPE
          else
            DEFAULT_TYPE
          end
      end

    private

      # @return [Agama::Config]
      attr_reader :product_config

      # Default bootloader type for most scenarios
      DEFAULT_TYPE = BootloaderType::GRUB2
      private_constant :DEFAULT_TYPE

      # Default bootloader type for systems in which a BLS-compliant bootloader is supported
      # TODO: change this to SYSTEMD_BOOT when we have sorted everthing out (encryption with TPM,
      # dual-booting, etc.).
      DEFAULT_BLS_TYPE = BootloaderType::GRUB2
      private_constant :DEFAULT_BLS_TYPE

      # Archs in which a BLS-compliant bootloader is supported
      BLS_ARCHS = [:x86_64, :i386, :aarch64, :arm, :riscv64].freeze
      private_constant :BLS_ARCHS

      # @return [BootloaderType, nil]
      def product_bls_type
        BootloaderType.find(product_config.data.dig("boot", "default_efi_bootloader"))
      end

      # Whether the usage of a BLS-compliant bootloader is supported
      #
      # @return [Boolean]
      def bls?
        return false unless ::Bootloader::Systeminfo.efi?

        BLS_ARCHS.any? { |a| Yast::Arch.public_send(a) }
      end
    end
  end
end
