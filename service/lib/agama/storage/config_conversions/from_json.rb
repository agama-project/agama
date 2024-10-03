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

require "agama/config"
require "agama/storage/config_conversions/from_json_conversions/config"
require "agama/storage/config_json_solver"

module Agama
  module Storage
    module ConfigConversions
      # Config conversion from JSON hash according to schema.
      class FromJSON
        # @param config_json [Hash]
        # @param default_paths [Array<String>] Default paths of the product.
        # @param mandatory_paths [Array<String>] Mandatory paths of the product.
        def initialize(config_json, default_paths: [], mandatory_paths: [])
          @config_json = config_json
          @default_paths = default_paths
          @mandatory_paths = mandatory_paths
        end

        # Performs the conversion from Hash according to the JSON schema.
        #
        # @return [Storage::Config]
        def convert
          # TODO: Raise error if config_json does not match the JSON schema.

          # Copies the JSON hash to avoid changes in the given config, see {ConfigJSONSolver}.
          config_json = json_dup(self.config_json)

          ConfigJSONSolver
            .new(default_paths: default_paths, mandatory_paths: mandatory_paths)
            .solve(config_json)

          FromJSONConversions::Config.new(config_json).convert
        end

      private

        # @return [Hash]
        attr_reader :config_json

        # @return [Array<String>]
        attr_reader :default_paths

        # @return [Array<String>]
        attr_reader :mandatory_paths

        # Deep dup of the given JSON.
        #
        # @param json [Hash]
        # @return [Hash]
        def json_dup(json)
          Marshal.load(Marshal.dump(json))
        end
      end
    end
  end
end
