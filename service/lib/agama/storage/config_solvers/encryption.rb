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

require "agama/storage/config_solvers/base"

module Agama
  module Storage
    module ConfigSolvers
      # Solver for the encryption configs.
      #
      # The encryption configs are solved by assigning the default encryption values defined by the
      # productd, if needed.
      class Encryption < Base
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

        def solve_encryptions
          config.with_encryption.each { |c| solve_encryption(c) }
        end

        # @param config [#encryption]
        def solve_encryption(config)
          return unless config.encryption

          encryption = config.encryption
          encryption.method ||= default_encryption.method
          solve_encryption_values(encryption)
        end

        def solve_physical_volumes_encryptions
          config.volume_groups.each { |c| solve_physical_volumes_encryption(c) }
        end

        # @param config [Configs::VolumeGroup]
        def solve_physical_volumes_encryption(config)
          return unless config.physical_volumes_encryption

          encryption = config.physical_volumes_encryption
          encryption.method ||= default_encryption.method
          solve_encryption_values(encryption)
        end

        # @param config [Configs::Encryption]
        def solve_encryption_values(config)
          # FIXME: We need better mechanisms to define these values (eg. the process for TpmFde
          # enforces pbkdf2, but that is not reflected in the case of planned devices).
          # As a first (not perfect) control mechanism, the values are ignored if the default
          # encryption type does not match
          return if config.method.encryption_type != default_encryption.method.encryption_type

          config.password ||= default_encryption.password
          config.pbkd_function ||= default_encryption.pbkd_function
          config.label ||= default_encryption.label
          config.cipher ||= default_encryption.cipher
          config.key_size ||= default_encryption.key_size
        end

        # Default encryption defined by the product.
        #
        # @return [Configs::Encryption]
        def default_encryption
          @default_encryption ||= config_builder.default_encryption
        end
      end
    end
  end
end
