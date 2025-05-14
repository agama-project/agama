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
require "y2storage/disk_analyzer"

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
      # @param devicegraph [Y2Storage::Devicegraph] initial layout of the system
      # @param disk_analyzer [Y2Storage::DiskAnalyzer, nil] extra information about the initial
      #   layout of the system
      def initialize(product_config, devicegraph, disk_analyzer: nil)
        @product_config = product_config
        @devicegraph = devicegraph
        @disk_analyzer = disk_analyzer || Y2Storage::DiskAnalyzer.new(devicegraph)
      end

      # Solves the config according to the product and the system.
      #
      # @note The config object is modified.
      #
      # @param config [Config]
      def solve(config)
        ConfigSolvers::Boot.new(product_config).solve(config)
        ConfigSolvers::Encryption.new(product_config).solve(config)
        ConfigSolvers::Filesystem.new(product_config).solve(config)
        ConfigSolvers::DrivesSearch.new(devicegraph, disk_analyzer).solve(config)
        ConfigSolvers::MdRaidsSearch.new(devicegraph, disk_analyzer).solve(config)
        # Sizes must be solved once the searches are solved.
        ConfigSolvers::Size.new(product_config, devicegraph).solve(config)
      end

    private

      # @return [Agama::Config]
      attr_reader :product_config

      # @return [Y2Storage::Devicegraph]
      attr_reader :devicegraph

      # @return [Y2Storage::DiskAnalyzer]
      attr_reader :disk_analyzer
    end
  end
end
