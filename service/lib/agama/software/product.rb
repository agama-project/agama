# frozen_string_literal: true

# Copyright (c) [2023-2025] SUSE LLC
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

require "agama/registration"

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
      # @return [String, nil]
      attr_accessor :display_name

      # Description of the product.
      #
      # @return [String, nil]
      attr_accessor :description

      # Internal name of the product. This is relevant for registering the product.
      #
      # @return [String, nil]
      attr_accessor :name

      # Version of the product. This is relevant for registering the product.
      #
      # @return [String, nil] E.g., "1.0".
      attr_accessor :version

      # Product icon. Please use specify filename with svg suffix and ensure referenced
      # file exists inside agama/web/src/assets/product.
      # `default.svg` will be used unless specified otherwise.
      #
      # @return [String] E.g. "leap.svg"
      attr_accessor :icon

      # List of repositories.
      #
      # @return [Array<String>] Empty if the product requires registration.
      attr_accessor :repositories

      # List of disk labels used for installation repository.
      #
      # @return [Array<String>] Empty if the product does not support offline installation.
      attr_accessor :labels

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

      # Preseleted patterns.
      #
      # These patterns are pre-selected if they are avaialble, but
      # the user can unselect them.
      #
      # @return [Array<String>]
      attr_accessor :preselected_patterns

      # Optional patterns.
      #
      # These patterns are always installed if they are available.
      #
      # @return [Array<String>]
      attr_accessor :optional_patterns

      # Optional user selectable patterns
      #
      # @return [Array<String>]
      attr_accessor :user_patterns

      # Whether the registration is enabled for the product.
      #
      # @return [boolean]
      attr_accessor :registration

      # Product translations.
      #
      # @example
      #   product.translations #=>
      #   {
      #     "description" => {
      #       "cs" => "Czech translation",
      #       "es" => "Spanish translation"
      #   }
      #
      # @return [Hash<String, Hash<String, String>>]
      attr_accessor :translations

      # License ID
      attr_accessor :license

      # @param id [string] Product id.
      def initialize(id)
        @id = id
        @icon = "default.svg"
        @repositories = []
        @labels = []
        @mandatory_packages = []
        @optional_packages = []
        @mandatory_patterns = []
        @optional_patterns = []
        @preselected_patterns = []
        # nil = display all visible patterns, [] = display no patterns
        @user_patterns = nil
        @registration = false
        @license = nil
        @translations = {}
      end

      # Localized product description.
      #
      # If there is no translation for the current language, then the untranslated description is
      # used.
      #
      # @return [String, nil]
      def localized_description
        translations = self.translations["description"]
        lang = ENV["LANG"]

        # No translations or language not set, return untranslated value.
        return description unless translations && lang

        # Remove the character encoding if present.
        lang = lang.split(".").first
        # Full matching (language + country)
        return translations[lang] if translations[lang]

        # Remove the country part.
        lang = lang.split("_").first
        # Partial match (just the language).
        return translations[lang] if translations[lang]

        # Fallback to original untranslated description.
        description
      end
    end
  end
end
