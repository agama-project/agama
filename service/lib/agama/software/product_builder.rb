# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

require "agama/software/product"

module Agama
  module Software
    # Builds products from the information of a config file.
    class ProductBuilder
      # @param config [Agama::Config]
      def initialize(config)
        @config = config
      end

      # Builds the products.
      #
      # @return [Array<Agama::Product>]
      def build
        config.products.map do |id, attrs|
          data = product_data_from_config(id)

          Agama::Software::Product.new(id).tap do |product|
            product.display_name = attrs["name"]
            product.description = attrs["description"]
            product.name = data[:name]
            product.version = data[:version]
            product.repositories = data[:repositories]
            product.mandatory_packages = data[:mandatory_packages]
            product.optional_packages = data[:optional_packages]
            product.mandatory_patterns = data[:mandatory_patterns]
            product.optional_patterns = data[:optional_patterns]
            product.user_patterns = data[:user_patterns]
            product.translations = attrs["translations"] || {}
          end
        end
      end

    private

      # @return [Agama::Config]
      attr_reader :config

      # Data from config, filtering by arch.
      #
      # @param id [String]
      # @return [Hash]
      def product_data_from_config(id)
        {
          name:               config.products.dig(id, "software", "base_product"),
          version:            config.products.dig(id, "software", "version"),
          repositories:       config.arch_elements_from(
            id, "software", "installation_repositories", property: :url
          ),
          mandatory_packages: config.arch_elements_from(
            id, "software", "mandatory_packages", property: :package
          ),
          optional_packages:  config.arch_elements_from(
            id, "software", "optional_packages", property: :package
          ),
          mandatory_patterns: config.arch_elements_from(
            id, "software", "mandatory_patterns", property: :pattern
          ),
          optional_patterns:  config.arch_elements_from(
            id, "software", "optional_patterns", property: :pattern
          ),
          user_patterns:      config.arch_elements_from(
            id, "software", "user_patterns", property: :pattern, default: nil
          )
        }
      end
    end
  end
end
