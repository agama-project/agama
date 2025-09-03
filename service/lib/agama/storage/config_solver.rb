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

require "agama/storage/config_solvers"

module Agama
  module Storage
    # Class for solving a storage config.
    #
    # Solving a config means to assign proper values according to the product and the system. For
    # example, the sizes of a partition config taking into account its fallbacks, assigning a
    # specific device when a config has a search, etc.
    #
    # See doc/storage_proposal_from_profile.md for a complete description of how the config is
    # generated from a profile.
    class ConfigSolver
      # @param product_config [Agama::Config] configuration of the product to install
      # @param storage_system [Storage::System]
      def initialize(product_config, storage_system)
        @product_config = product_config
        @storage_system = storage_system
      end

      # Solves the config according to the product and the system.
      #
      # @note The config object is modified.
      #
      # @param config [Config]
      def solve(config)
        ConfigSolvers::Encryption.new(product_config).solve(config)
        ConfigSolvers::Filesystem.new(product_config).solve(config)
        ConfigSolvers::DrivesSearch.new(storage_system).solve(config)
        ConfigSolvers::MdRaidsSearch.new(storage_system).solve(config)
        # Sizes and boot must be solved once the searches are solved.
        ConfigSolvers::Boot.new(product_config, storage_system).solve(config)
        ConfigSolvers::Size.new(product_config).solve(config)
      end

    private

      # @return [Agama::Config]
      attr_reader :product_config

      # @return [Storage::System]
      attr_reader :storage_system
    end
  end
end
