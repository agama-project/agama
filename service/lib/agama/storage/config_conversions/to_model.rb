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

require "agama/storage/config_conversions/to_model_conversions/config"

module Agama
  module Storage
    module ConfigConversions
      # Config conversion to model according to the JSON schema.
      class ToModel
        # @param config [Storage::Config]
        # @param product_config [Agama::Config, nil] Agama config
        def initialize(config, product_config = nil)
          @config = config
          @product_config = product_config
        end

        # Performs the conversion to config model according to the JSON schema.
        #
        # @return [Hash]
        def convert
          ToModelConversions::Config.new(config, product_config).convert
        end

      private

        # @return [Storage::Config]
        attr_reader :config

        # @return [Agama::Config, nil]
        attr_reader :product_config
      end
    end
  end
end
