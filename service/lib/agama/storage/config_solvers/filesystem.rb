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
      # Solver for the filesystem configs.
      #
      # The filesystem configs are solved by assigning the default filesystem values defined by the
      # productd, if needed.
      class Filesystem < Base
        # Solves all the filesystem configs within a given config.
        #
        # @note The config object is modified.
        #
        # @param config [Config]
        def solve(config)
          @config = config

          config.with_filesystem.each { |c| solve_filesystem(c) }
        end

      private

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
      end
    end
  end
end
