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

require "agama/storage/config_search_solver"
require "agama/storage/config_size_solver"

module Agama
  module Storage
    # Class for solving a storage config.
    #
    # It assigns proper devices and size values according to the product and the system.
    class ConfigSolver
      # @param devicegraph [Y2Storage::Devicegraph]
      # @param product_config [Agama::Config]
      def initialize(devicegraph, product_config)
        @devicegraph = devicegraph
        @product_config = product_config
      end

      # Solves all the search and size configs within a given config.
      #
      # @note The config object is modified.
      #
      # @param config [Config]
      def solve(config)
        ConfigSearchSolver.new(devicegraph).solve(config)
        ConfigSizeSolver.new(devicegraph, product_config).solve(config)
      end

    private

      # @return [Y2Storage::Devicegraph]
      attr_reader :devicegraph

      # @return [Agama::Config]
      attr_reader :product_config
    end
  end
end
