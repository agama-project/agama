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

module Agama
  module Software
    # Represents a product that Agama can install.
    class Product
      # Product id.
      #
      # @return [String]
      attr_reader :id

      # Name of the product to be display.
      #
      # @return [String]
      attr_accessor :display_name

      # Description of the product.
      #
      # @return [String]
      attr_accessor :description

      # Internal name of the product. This is relevant for registering the product.
      #
      # @return [String]
      attr_accessor :name

      # Version of the product. This is relevant for registering the product.
      #
      # @return [String] E.g., "1.0".
      attr_accessor :version

      # List of repositories.
      #
      # @return [Array<String>] Empty if the product requires registration.
      attr_accessor :repositories

      # Mandatory packages.
      #
      # @return [Array<String>]
      attr_accessor :mandatory_packages

      # Optional packages.
      #
      # @return [Array<String>]
      attr_accessor :optional_packages

      # Mandatory patterns.
      #
      # @return [Array<String>]
      attr_accessor :mandatory_patterns

      # Optional patterns.
      #
      # @return [Array<String>]
      attr_accessor :optional_patterns

      # @param id [string] Product id.
      def initialize(id)
        @id = id
        @repositories = []
        @mandatory_packages = []
        @optional_packages = []
        @mandatory_patterns = []
        @optional_patterns = []
      end
    end
  end
end
