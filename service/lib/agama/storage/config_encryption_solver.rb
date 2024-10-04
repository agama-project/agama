# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require "agama/storage/config_builder"

module Agama
  module Storage
    # Solver for the encryption configs.
    #
    # The encryption configs are solved by assigning the default encryption values defined by the
    # productd, if needed.
    class ConfigEncryptionSolver
      # @param product_config [Agama::Config]
      def initialize(product_config)
        @product_config = product_config
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

      # @return [Agama::Config]
      attr_reader :product_config

      # @return [Config]
      attr_reader :config

      def solve_encryptions
        configs_with_encryption.each { |c| solve_encryption(c) }
      end

      # @param config [#encryption]
      def solve_encryption(config)
        return unless config.encryption

        encryption = config.encryption
        encryption.method ||= default_encryption.method

        # Recovering values from the default encryption only makes sense if the encryption method is
        # the same.
        solve_encryption_values(encryption) if encryption.method == default_encryption.method
      end

      def solve_physical_volumes_encryptions
        config.volume_groups.each { |c| solve_physical_volumes_encryption(c) }
      end

      # @param config [Configs::VolumeGroup]
      def solve_physical_volumes_encryption(config)
        return unless config.physical_volumes_encryption

        encryption = config.physical_volumes_encryption
        encryption.method ||= default_encryption.method

        # Recovering values from the default encryption only makes sense if the encryption method is
        # the same.
        solve_encryption_values(encryption) if encryption.method == default_encryption.method
      end

      # @param config [Configs::Encryption]
      def solve_encryption_values(config)
        config.password ||= default_encryption.password
        config.pbkd_function ||= default_encryption.pbkd_function
        config.label ||= default_encryption.label
        config.cipher ||= default_encryption.cipher
        config.key_size ||= default_encryption.key_size
      end

      # @return [Array<#encryption>]
      def configs_with_encryption
        config.drives + config.partitions + config.logical_volumes
      end

      # Default encryption defined by the product.
      #
      # @return [Configs::Encryption]
      def default_encryption
        @default_encryption ||= config_builder.default_encryption
      end

      # @return [ConfigBuilder]
      def config_builder
        @config_builder ||= ConfigBuilder.new(product_config)
      end
    end
  end
end
