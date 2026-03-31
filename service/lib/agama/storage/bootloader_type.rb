# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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
  module Storage
    # Enum-like class to represent the possible bootloader types at BootloaderConfig
    class BootloaderType
      # Constructor, to be used internally by the class
      #
      # @param value [String] see {#value}
      def initialize(value)
        @value = value
      end

      # Instance of the function to be always returned by the class
      GRUB2 = new("grub2")
      # Instance of the function to be always returned by the class
      SYSTEMD_BOOT = new("systemd-boot")
      # Instance of the function to be always returned by the class
      GRUB2_BLS = new("grub2-bls")
      # Instance of the function to be always returned by the class
      NONE = new("none")

      # All possible instances
      ALL = [GRUB2, SYSTEMD_BOOT, GRUB2_BLS, NONE].freeze
      private_constant :ALL

      # List of all possible types
      def self.all
        ALL.dup
      end

      # Finds a type by its value
      #
      # @param value [#to_s]
      # @return [BootloaderType, nil] nil if such value does not exist
      def self.find(value)
        ALL.find { |type| type.value == value.to_s }
      end

      # @return [String] value to represent the type in the config
      attr_reader :value

      alias_method :to_s, :value

      # @return [Symbol]
      def to_sym
        value.to_sym
      end

      # Checks whether the object corresponds to any of the given enum values.
      #
      # By default, this will be the base comparison used in the case statements.
      #
      # @param names [#to_sym]
      # @return [Boolean]
      def is?(*names)
        names.any? { |n| n.to_sym == to_sym }
      end

      # @return [Boolean]
      def ==(other)
        other.class == self.class && other.value == value
      end

      alias_method :eql?, :==

      # @return [Boolean]
      def ===(other)
        other.instance_of?(self.class) && is?(other)
      end
    end
  end
end
