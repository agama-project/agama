# Copyright (c) [2021] SUSE LLC
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
  # Mixin for classes that require to define a custom comparison
  #
  # By default, the methods #==, #eql? and #equal? in Object subclasses return true if both objects
  # are the same (point to the same object in memory). Actually #eql? should return true if both
  # objects refer to the same hash key. But in practice, two objects have the same hash key if they
  # are the very same object. There are some exceptions like String, which returns the same hash key
  # if they have the same value.
  #
  # The #eql? and #hash methods must be related. That is, if two objects are #eql?, then they should
  # have the same #hash. This is important, otherwise we could have unexpected results in certain
  # operations like subtracting Arrays. When performing the difference of two Arrays, the method
  # used for comparing the objects in the Array depends on the Array length (see source code of
  # Array#difference). If both Arrays have more than SMALL_ARRAY_LEN (i.e., 16) elements, then
  # the #hash method is used. Otherwise it uses #eql?. This is one of the reason why #eql? and #hash
  # should be paired.
  #
  # @example
  #   class Foo
  #     include Equatable
  #
  #     attr_reader :attr1, :attr2
  #
  #     eql_attr :attr1
  #
  #     def initialize(attr1, attr2)
  #       @attr1 = attr1
  #       @attr2 = attr2
  #     end
  #   end
  #
  #   foo1 = Foo.new("a", "b")
  #   foo2 = Foo.new("a", "c")
  #
  #   foo1 == foo2      #=> true
  #   foo1.eql?(foo2)   #=> true
  #   foo1.equal?(foo2) #=> false
  module Equatable
    def self.included(base)
      base.extend(ClassMethods)
    end

    # Class methods for defining the attributes to consider when comparing objects
    module ClassMethods
      # Inherited classes must remember the attributes for comparison from its parent class
      def inherited(subclass)
        super

        subclass.eql_attr(*eql_attrs)
      end

      # Name of the attributes to consider when comparing objects
      #
      # @return [Array<Symbol>]
      def eql_attrs
        @eql_attrs || []
      end

      # Saves the name of the attributes to use when comparing objects
      #
      # @param names [Array<Symbol>]
      def eql_attr(*names)
        @eql_attrs ||= []
        @eql_attrs += names
      end
    end

    # Returns a Hash containing all the attributes and values used for comparing
    # the objects as well as a :class key with the object class as the value.
    #
    # @return [Hash<Symbol, Object]
    def eql_hash
      ([[:class, self.class]] + self.class.eql_attrs.map { |m| [m, send(m)] }).to_h
    end

    # Hash key to identify objects
    #
    # Objects with the same values for their eql_attrs have the same hash
    #
    # @return [Integer]
    def hash
      eql_hash.hash
    end

    # Whether the objects have the same hash key
    #
    # @param other [Object]
    # @return [Boolean]
    def eql?(other)
      hash == other.hash
    end

    alias_method :==, :eql?
  end
end
