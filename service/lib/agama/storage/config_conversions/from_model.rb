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

require "agama/config"
require "agama/storage/config_conversions/from_model_conversions/config"
require "agama/storage/system"

module Agama
  module Storage
    module ConfigConversions
      # Config conversion from model according to the JSON schema.
      class FromModel
        # @param model_json [Hash]
        # @param product_config [Agama::Config, nil]
        # @param storage_system [Storage::System, nil]
        def initialize(model_json, product_config: nil, storage_system: nil)
          @model_json = model_json
          @product_config = product_config || Agama::Config.new
          @storage_system = storage_system || Storage::System.new
        end

        # Performs the conversion from model according to the JSON schema.
        #
        # @return [Storage::Config]
        def convert
          # TODO: Raise error if model_json does not match the JSON schema.
          FromModelConversions::Config.new(model_json, product_config, storage_system).convert
        end

      private

        # @return [Hash]
        attr_reader :model_json

        # @return [Agama::Config]
        attr_reader :product_config

        # @return [Storage::System]
        attr_reader :storage_system
      end
    end
  end
end
