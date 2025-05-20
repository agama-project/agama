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

require "agama/storage/config_builder"

module Agama
  module Storage
    module ConfigSolvers
      # Base class for config solvers.
      class Base
        # @param product_config [Agama::Config]
        def initialize(product_config)
          @product_config = product_config
        end

        # Solves a given config.
        #
        # @note Derived classes must implement this method.
        #
        # @param _config [Config]
        def solve(_config)
          raise NotImplementedError
        end

      private

        # @return [Agama::Config]
        attr_reader :product_config

        # @return [Config]
        attr_reader :config

        # @return [ConfigBuilder]
        def config_builder
          @config_builder ||= ConfigBuilder.new(product_config)
        end
      end
    end
  end
end
