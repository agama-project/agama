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

require "agama/dbus/types"

module Agama
  module DBus
    # Validates a Hash (dictionary) from D-Bus according to an scheme.
    #
    # This validation is useful to check the expected types of a D-Bus call when some parameter is
    # a dictionary with variant types.
    #
    # @example
    #   # Let's say there is a D-Bus method with the following signature:
    #
    #   dbus_method :Calculate, "in settings:a{sv}"
    #
    #   # The settings parameter will be transformed to a ruby Hash and this class allows to
    #   # validate the types of the hash values.
    #
    #   scheme = {
    #     "ID"       => Integer,
    #     "Name"     => String,
    #     "Children" => Agama::DBus::Types.Array.new(Integer)
    #   }
    #
    #   value1 = { "ID" => 10, "Name" => "Foo", "Color" => "red" }
    #   validator = HashValidator.new(value1, scheme: scheme)
    #   validator.valid?          #=> true
    #   validator.missing_keys    #=> ["Children"]
    #   validator.extra_keys      #=> ["Color"]
    #   validator.issues          #=> ["Unknown D-Bus property Color"]
    #
    #   value2 = { "ID" => 10, "Name" => 33 }
    #   validator = HashValidator.new(value2, scheme: scheme)
    #   validator.valid?          #=> false
    #   validator.missing_keys    #=> ["Children"]
    #   validator.wrong_type_keys #=> ["Name"]
    #   validator.issues.size     #=> 1
    class HashValidator
      # @param value [Hash{String => Object}] Hash to validate.
      # @param scheme [Hash{String => Class, Types::BOOL, Types::Array, Types::Hash}] Scheme
      #   for validating the hash.
      def initialize(value, scheme:)
        @value = value
        @scheme = scheme
      end

      # Whether the hash is valid.
      #
      # The hash is consider as valid if there is no key with wrong type. Missing and extra keys are
      # not validated.
      #
      # @return [Boolean]
      def valid?
        wrong_type_keys.none?
      end

      # Keys with correct type.
      #
      # Missing and extra keys are ignored.
      #
      # @return [Array<String>]
      def valid_keys
        value.keys.select { |k| valid_key?(k) }
      end

      # Keys with incorrect type.
      #
      # Missing and extra keys are ignored.
      #
      # @return [Array<String>]
      def wrong_type_keys
        value.keys.select { |k| !extra_key?(k) && wrong_type_key?(k) }
      end

      # Keys not included in the scheme.
      #
      # @return [Array<String>]
      def extra_keys
        value.keys.select { |k| extra_key?(k) }
      end

      # Keys included in the scheme but missing in the hash value.
      #
      # @return [Array<String>]
      def missing_keys
        scheme.keys - value.keys
      end

      # List of issues.
      #
      # There is an issue for each extra key and for each key with wrong type.
      #
      # @return [Array<String>]
      def issues
        issues = []

        extra_keys.map do |key|
          issues << "Unknown D-Bus property #{key}"
        end

        wrong_type_keys.map do |key|
          type = scheme[key]
          value = self.value[key]

          issues << "D-Bus property #{key} must be #{type}: #{value} (#{value.class})"
        end

        issues
      end

    private

      # @return [Hash{String => Object}]
      attr_reader :value

      # @return [Hash{String => Class, Types::BOOL, Types::Array, Types::Hash}]
      attr_reader :scheme

      def valid_key?(key)
        !(extra_key?(key) || wrong_type_key?(key))
      end

      def extra_key?(key)
        !scheme.keys.include?(key)
      end

      def wrong_type_key?(key)
        type = scheme[key]
        checker = Types::Checker.new(type)
        !checker.match?(value[key])
      end
    end
  end
end
