# Copyright (c) [2021-2022] SUSE LLC
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

require "yast"

module Y2Storage
  # Class to represent each one of the possible values for {Y2Storage::Encryption#pbkdf}
  class PbkdFunction
    include Yast::I18n
    extend Yast::I18n

    # Constructor, to be used internally by the class
    #
    # @param value [String] see {#value}
    # @param name [String] string marked for translation, see {#name}
    def initialize(value, name)
      textdomain "storage"

      @value = value
      @name = name
    end

    # Instance of the function to be always returned by the class
    # TRANSLATORS: name of a key derivation function used by LUKS
    ARGON2ID = new("argon2id", N_("Argon2id"))
    # Instance of the function to be always returned by the class
    # TRANSLATORS: name of a key derivation function used by LUKS
    ARGON2I = new("argon2i", N_("Argon2i"))
    # Instance of the function to be always returned by the class
    # TRANSLATORS: name of a key derivation function used by LUKS
    PBKDF2 = new("pbkdf2", N_("PBKDF2"))

    # All possible instances
    ALL = [ARGON2ID, ARGON2I, PBKDF2].freeze
    private_constant :ALL

    # Sorted list of all possible roles
    def self.all
      ALL.dup
    end

    # Finds a function by its value
    #
    # @param value [#to_s]
    # @return [PbkdFunction, nil] nil if such value does not exist
    def self.find(value)
      ALL.find { |opt| opt.value == value.to_s }
    end

    # @return [String] value for {Y2Storage::Encryption#pbkdf}
    attr_reader :value

    # @return [String] localized name for the function to display in the UI
    def name
      _(@name)
    end

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
