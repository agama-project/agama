# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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

module Agama
  module Storage
    module ConfigSolvers
      # Solver for the encryption configs.
      #
      # The encryption configs are solved by assigning the default encryption values required by the
      # used bootloader, if needed.
      class Encryption
        # @param bootloader_config [Storage::BootloaderConfig]
        def initialize(bootloader_config)
          @bootloader_config = bootloader_config
        end

        # Solves all the encryption configs within a given config.
        #
        # @note The config object is modified.
        #
        # @param config [Config]
        def solve(config)
          @config = config

          solve_encryptions
          solve_physical_volumes_encryptions
        end

      private

        # @return [Storage::BootloaderConfig]
        attr_reader :bootloader_config

        # @return [Config]
        attr_reader :config

        def solve_encryptions
          config.supporting_encryption.each { |c| solve_encryption(c) }
        end

        # @param config [#encryption]
        def solve_encryption(config)
          return unless config.encryption

          solve_encryption_values(config.encryption)
        end

        def solve_physical_volumes_encryptions
          config.volume_groups.each { |c| solve_physical_volumes_encryption(c) }
        end

        # @param config [Configs::VolumeGroup]
        def solve_physical_volumes_encryption(config)
          return unless config.physical_volumes_encryption

          encryption = config.physical_volumes_encryption
          solve_encryption_values(encryption)
        end

        # @param config [Configs::Encryption]
        def solve_encryption_values(config)
          bootloader_type = bootloader_config.type
          # The bootloader type is always known because bootloader_config is already solved,
          # but this is defensive code to ensure backwards compatibility even with the tests
          return if bootloader_type && !bootloader_type.is?(:grub2)

          # Grub2 can only open encryption devices using PBKDF2, so let's be conservative
          # and use that function by default for all devices.
          config.pbkd_function ||= Y2Storage::PbkdFunction::PBKDF2
        end
      end
    end
  end
end
