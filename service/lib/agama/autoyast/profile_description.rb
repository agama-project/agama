#!/usr/bin/env ruby
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

require "json"

module Agama
  module AutoYaST
    # Describes an AutoYaST element and its support level in Agama
    class ProfileElement
      # @return [String] Element key.
      attr_reader :key
      # @return [String] Additional information about the element.
      attr_reader :notes
      # @return [String] Agama equivalent attribute
      attr_reader :agama
      # @return [Array<ProfileElement>] Children elements.
      attr_reader :children

      class << self
        # Builds a ProfileElement from its JSON description.
        def from_json(json, parent = nil)
          support = json.key?("children") ? :yes : json["support"]&.to_sym
          key = parent ? "#{parent}.#{json["key"]}" : json["key"]
          children = json.fetch("children", []).map do |json_element|
            ProfileElement.from_json(json_element, key)
          end
          ProfileElement.new(key, support, json["agama"], json["notes"], children)
        end
      end

      # Constructor
      #
      # @param key [String] Element key.
      # @param support [String, nil] Support level.
      # @param notes [String] Additional information about the element.
      # @param agama [String] Agama equivalent attribute
      # @param children [Array<ProfileElement>] Children elements.
      def initialize(key, support, agama, notes, children = [])
        @key = key
        @support = support
        @notes = notes
        @agama = agama
        @children = children
      end

      # Whether the element is supported.
      #
      # @return [Boolean]
      def supported?
        support == :yes
      end

      # Returns the support level.
      #
      # If it was not specified when building the object, it infers it from its children. If the
      # element has no children, it returns :no.
      def support
        return @support if @support

        nested = children.map(&:support).uniq
        return nested.first if nested.size == 1
        return :partial if nested.include?(:yes) || nested.include?(:partial)
        return :planned if nested.include?(:planned)

        :no
      end

      # Whether it is a top level element.
      #
      # @return [Boolean]
      def top_level?
        !key.include?(".")
      end

      # Short key name.
      #
      # @return [String]
      def short_key
        key.split(".").last
      end
    end

    # Describes the AutoYaST profile format.
    class ProfileDescription
      attr_reader :elements

      DEFAULT_PATH = File.expand_path("#{__dir__}/../../../share/autoyast-compat.json")

      class << self
        # Load the AutoYaST profile definition.
        #
        # @param path [String] Path of the profile definition.
        # @return [ProfileDescription]
        def load(path = DEFAULT_PATH)
          json = JSON.load_file(path)
          elements = json.map do |json_element|
            ProfileElement.from_json(json_element)
          end
          new(elements)
        end
      end

      # Constructor
      #
      # @param elements [Array<ProfileElement>] List of profile elements
      def initialize(elements)
        @elements = elements
        @index = create_index(elements)
      end

      # Find an element by its key
      #
      # @param key [String] Element key (e.g., "networking.base")
      def find_element(key)
        element = @index.dig(*key.split("."))
        element.is_a?(ProfileElement) ? element : nil
      end

    private

      # Creates an index to make searching for an element faster and easier.
      def create_index(elements)
        elements.each_with_object({}) do |e, index|
          index[e.short_key] = if e.children.empty?
            e
          else
            create_index(e.children)
          end
        end
      end
    end
  end
end
