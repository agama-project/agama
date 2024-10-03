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
    # Solver for the filesystem configs.
    #
    # The filesystem configs are solved by assigning the default filesystem values defined by the
    # productd, if needed.
    class ConfigFilesystemSolver
      # @param product_config [Agama::Config]
      def initialize(product_config)
        @product_config = product_config
      end

      # Solves all the filesystem configs within a given config.
      #
      # @note The config object is modified.
      #
      # @param config [Config]
      def solve(config)
        @config = config

        configs_with_filesystem.each { |c| solve_filesystem(c) }
      end

    private

      # @return [Agama::Config]
      attr_reader :product_config

      # @return [Config]
      attr_reader :config

      # @param config [#filesystem]
      def solve_filesystem(config)
        return unless config.filesystem

        default_filesystem = default_filesystem(config.filesystem.path)

        config.filesystem.type ||= default_filesystem.type
        config.filesystem.type.btrfs ||= default_filesystem.type.btrfs
        solve_btrfs_values(config)
      end

      # @param config [#filesystem]
      def solve_btrfs_values(config)
        btrfs = config.filesystem.type.btrfs
        return unless btrfs

        default_btrfs = default_btrfs(config.filesystem.path)

        btrfs.snapshots = default_btrfs.snapshots? if btrfs.snapshots.nil?
        btrfs.read_only = default_btrfs.read_only? if btrfs.read_only.nil?
        btrfs.subvolumes ||= default_btrfs.subvolumes
        btrfs.default_subvolume ||= (default_btrfs.default_subvolume || "")
      end

      # @return [Array<#filesystem>]
      def configs_with_filesystem
        config.drives + config.partitions + config.logical_volumes
      end

      # Default filesystem defined by the product.
      #
      # @param path [String, nil]
      # @return [Configs::Filesystem]
      def default_filesystem(path = nil)
        config_builder.default_filesystem(path)
      end

      # Default btrfs config defined by the product.
      #
      # @param path [String, nil]
      # @return [Configs::Btrfs]
      def default_btrfs(path = nil)
        default_filesystem(path).type.btrfs
      end

      # @return [ConfigBuilder]
      def config_builder
        @config_builder ||= ConfigBuilder.new(product_config)
      end
    end
  end
end
