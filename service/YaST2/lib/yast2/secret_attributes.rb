# Copyright (c) [2017] SUSE LLC
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

module Yast2
  # Mixin that enables a class to define attributes that are never exposed via
  #   #inspect, #to_s or similar methods, with the goal of preventing
  #   unintentional leaks of sensitive information in the application logs.
  module SecretAttributes
    # Inner class to store the value of the attribute without exposing it
    # directly
    class Attribute
      attr_reader :value

      def initialize(value)
        @value = value
      end

      def to_s
        value.nil? ? "" : "<secret>"
      end

      def inspect
        value.nil? ? "nil" : "<secret>"
      end

      def instance_variables
        # This adds even an extra barrier, just in case some formatter tries to
        # use deep instrospection
        []
      end
    end

    # Class methods for the mixin
    module ClassMethods
      # Similar to .attr_accessor but with additional mechanisms to prevent
      # exposing the internal value of the attribute
      #
      # @example
      #   class TheClass
      #     include Yast2::SecretAttributes
      #
      #     attr_accessor :name
      #     secret_attr :password
      #   end
      #
      #   one_object = TheClass.new
      #   one_object.name = "Aa"
      #   one_object.password = "42"
      #
      #   one_object.password # => "42"
      #   one_object.inspect # => "#<TheClass:0x0f8 @password=<secret>, @name=\"Aa"\">"
      def secret_attr(name)
        define_method(:"#{name}") do
          attribute = instance_variable_get(:"@#{name}")
          attribute ? attribute.value : nil
        end

        define_method(:"#{name}=") do |value|
          instance_variable_set(:"@#{name}", Attribute.new(value))
          value
        end
      end
    end

    def self.included(base)
      base.extend(ClassMethods)
    end
  end
end
