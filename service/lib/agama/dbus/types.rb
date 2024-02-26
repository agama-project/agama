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

module Agama
  module DBus
    # This module offers classes to help to validate the expected types from a D-Bus call when
    # variant types are involved, typically using dictionaries.
    #
    # @example
    #   # Let's say there is a D-Bus method with the following signature:
    #
    #   dbus_method :Calculate, "in settings:a{sv}"
    #
    #   # The settings parameter will be transformed to a ruby Hash. This module provides a
    #   # {Checker} class that helps to validate the expected types.
    #
    #   # Checks whether the value is a String
    #   checker = Types::Checker.new(String)
    #   checker.match?(settings["Foo"])
    #
    #   # Checks whether the value is bool
    #   checker = Types::Checker.new(Types::BOOL)
    #   checker.match?(settings["Foo"])
    #
    #   # Checks whether the value is an Array of String
    #   checker = Types::Checker.new(Types::Array.new(String))
    #   checker.match?(settings["Foo"])
    #
    #   # Checks whether the value is a Hash of String keys and Integer values
    #   checker = Types::Checker.new(Types::Hash.new(k: String, v: Integer))
    #   checker.match?(settings["Foo"])
    #
    # See {HashValidator} for validating hashes coming from D-Bus according to a scheme.
    module Types
      # Type representing a boolean (true or false).
      BOOL = :bool

      # Type representing an array of values.
      class Array
        # @return [Class, Module, BOOL, Array, Hash, nil]
        attr_reader :elements_type

        # @param elements_type [Class, Module, BOOL, Array, Hash, nil] The type of the elements in
        #   the array. If nil, the type of the elements is not checked.
        def initialize(elements_type = nil)
          @elements_type = elements_type
        end
      end

      # Type representing a hash.
      class Hash
        # @return [Class, Module, BOOL, Array, Hash, nil]
        attr_reader :keys_type

        # @return [Class, Module, BOOL, Array, Hash, nil]
        attr_reader :values_type

        # @param key [Class, Module, BOOL, Array, Hash, nil] The type of keys. If nil, the type of
        #   the keys is not checked.
        # @param value [Class, Module, BOOL, Array, Hash, nil] The type of values. If nil, the type
        #   of the values is not checked.
        def initialize(key: nil, value: nil)
          @keys_type = key
          @values_type = value
        end
      end

      # Checks whether a value matches a type.
      class Checker
        # @param type [Class, Module, BOOL, Array, Hash] The type to check.
        def initialize(type)
          @type = type
        end

        # Whether the given value matches the type.
        #
        # @param value [Object]
        # @return [Boolean]
        def match?(value)
          case type
          when BOOL
            match_bool?(value)
          when Agama::DBus::Types::Array
            match_array?(value)
          when Agama::DBus::Types::Hash
            match_hash?(value)
          when Class, Module
            value.is_a?(type)
          else
            false
          end
        end

      private

        # @return [Class, Module, BOOL, Array, Hash]
        attr_reader :type

        # Whether the value matches with {BOOL} type.
        #
        # @return [Boolean]
        def match_bool?(value)
          value.is_a?(TrueClass) || value.is_a?(FalseClass)
        end

        # Whether the value matches with {Array} type.
        #
        # @return [Boolean]
        def match_array?(value)
          return false unless value.is_a?(::Array)

          if type.elements_type
            checker = Checker.new(type.elements_type)
            return value.all? { |v| checker.match?(v) }
          end

          true
        end

        # Whether the value matches with {Hash} type.
        #
        # @return [Boolean]
        def match_hash?(value)
          return false unless value.is_a?(::Hash)

          if type.keys_type
            checker = Checker.new(Types::Array.new(type.keys_type))
            return false unless checker.match?(value.keys)
          end

          if type.values_type
            checker = Checker.new(Types::Array.new(type.values_type))
            return false unless checker.match?(value.values)
          end

          true
        end
      end
    end
  end
end
