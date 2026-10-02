# Copyright (c) [2015] SUSE LLC
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

# This file can be invoked separately for minimal testing.

module Y2Storage
  #
  # Class to handle disk sizes in the MB/GB/TB range with readable output.
  #
  # Disk sizes are stored internally in bytes. Negative values are
  # allowed in principle but the special value -1 is reserved to mean
  # 'unlimited'.
  #
  # {DiskSize} objects are used through {Y2Storage} whenever a size has to be specified.
  # Notable exception here is class {Region} where several methods expect Integer arguments.
  # Like {Region#start}, {Region#length}, {Region#end}, and others.
  #
  # To get the size in bytes, use {to_i}.
  #
  # @example
  #   x = DiskSize.MiB(6)   #=> <DiskSize 6.00 MiB (6291456)>
  #   x.to_i                #=> 6291456
  #
  class DiskSize
    include Comparable

    UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"]
    # Old units from AutoYaST (to be deprecated)
    DEPRECATED_UNITS = ["K", "M", "G"]
    # International System of Units (SI)
    SI_UNITS = ["KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
    UNLIMITED = "unlimited"

    # Return {DiskSize} in bytes.
    #
    # @return [Integer]
    #
    # @example
    #   x = DiskSize.KB(8)    #=> <DiskSize 7.81 KiB (8000)>
    #   x.to_i                #=> 8000
    #
    # @example Unlimited size is represented internally by -1.
    #   x = DiskSize.unlimited    #=> <DiskSize <unlimited> (-1)>
    #   x.to_i                    #=> -1
    #
    attr_reader :size
    alias_method :to_i, :size
    alias_method :to_storage_value, :size

    # @!method new(size = 0)
    # @!scope class
    #
    # Accepts +Numeric+, +Strings+, or {DiskSize} objects as initializers.
    # @raise [TypeError] if anything else is used as initializer
    #
    # @see initialize
    # @see parse
    #
    # @param size [Numeric, String, DiskSize]
    # @return [DiskSize]
    #
    # @example Create 16 MiB DiskSize objects
    #   size1 = DiskSize.new(16*1024*1024)   #=> <DiskSize 16.00 MiB (16777216)>
    #   size2 = DiskSize.new("16 MiB")       #=> <DiskSize 16.00 MiB (16777216)>
    #   size3 = DiskSize.new(size1)          #=> <DiskSize 16.00 MiB (16777216)>
    #
    # @example The default is size 0
    #   DiskSize.new                         #=> <DiskSize 0.00 B (0)>
    #
    # @example You can have unlimited (infinite) size
    #   DiskSize.new("unlimited")            #=> <DiskSize <unlimited> (-1)>

    # @see new
    def initialize(size = 0)
      @size =
        if size.is_a?(Y2Storage::DiskSize)
          size.to_i
        elsif size.is_a?(::String)
          Y2Storage::DiskSize.parse(size).size
        elsif size.respond_to?(:round)
          size.round
        end
      raise(TypeError, "Cannot convert #{size.inspect} to DiskSize") unless @size
    end

    #
    # Factory methods
    #
    class << self
      # @!method B(size)
      #
      # Create {DiskSize} object in byte units.
      #
      # @param size [Float]
      # @return [DiskSize]
      #
      # @example These are 16 Bytes
      #   DiskSize.B(16)   #=> <DiskSize 16.00 B (16)>

      # @!method KiB(size)
      #
      # Create {DiskSize} object in KiB (2^10) units.
      #
      # @param size [Float]
      # @return [DiskSize]
      #
      # @example These are 16 KiB
      #   DiskSize.KiB(16)   #=> <DiskSize 16.00 KiB (16384)>

      # @!method KB(size)
      #
      # Create {DiskSize} object in KB (10^3) units.
      #
      # @param size [Float]
      # @return [DiskSize]
      #
      # @example These are 16 KB
      #   DiskSize.KB(16)   #=> <DiskSize 15.62 KiB (16000)>

      # @!method MiB(size)
      #
      # Create {DiskSize} object in MiB (2**20) units.
      #
      # @param size [Float]
      # @return [DiskSize]
      #
      # @example These are 16 MiB
      #   DiskSize.MiB(16)   #=> <DiskSize 16.00 MiB (16777216)>

      # @!method MB(size)
      #
      # Create {DiskSize} object in MB (10^6) units.
      #
      # @param size [Float]
      # @return [DiskSize]
      #
      # @example These are 16 MB
      #   DiskSize.MB(16)   #=> <DiskSize 15.26 MiB (16000000)>

      # @!method GiB(size)
      #
      # Create {DiskSize} object in GiB (2**30) units.
      #
      # @param size [Float]
      # @return [DiskSize]
      #
      # @example These are 16 GiB
      #   DiskSize.GiB(16)   #=> <DiskSize 16.00 GiB (17179869184)>

      # @!method GB(size)
      #
      # Create {DiskSize} object in GB (10^9) units.
      #
      # @param size [Float]
      # @return [DiskSize]
      #
      # @example These are 16 GB
      #   DiskSize.GB(16)   #=> <DiskSize 14.90 GiB (16000000000)>

      # @!method TiB(size)
      #
      # Create {DiskSize} object in TiB (2**40) units.
      #
      # @param size [Float]
      # @return [DiskSize]
      #
      # @example These are 16 TiB
      #   DiskSize.TiB(16)   #=> <DiskSize 16.00 TiB (17592186044416)>

      # @!method TB(size)
      #
      # Create {DiskSize} object in TB (10^12) units.
      #
      # @param size [Float]
      # @return [DiskSize]
      #
      # @example These are 16 TB
      #   DiskSize.TB(16)   #=> <DiskSize 14.55 TiB (16000000000000)>

      # @!method PiB(size)
      #
      # Create {DiskSize} object in PiB (2**50) units.
      #
      # @param size [Float]
      # @return [DiskSize]
      #
      # @example These are 16 PiB
      #   DiskSize.PiB(16)   #=> <DiskSize 16.00 PiB (18014398509481984)>

      # @!method PB(size)
      #
      # Create {DiskSize} object in PB (10^15) units.
      #
      # @param size [Float]
      # @return [DiskSize]
      #
      # @example These are 16 PB
      #   DiskSize.PB(16)   #=> <DiskSize 14.21 PiB (16000000000000000)>

      # @!method EiB(size)
      #
      # Create {DiskSize} object in EiB (2**60) units.
      #
      # @param size [Float]
      # @return [DiskSize]
      #
      # @example These are 16 EiB
      #   DiskSize.EiB(16)   #=> <DiskSize 16.00 EiB (18446744073709551616)>

      # @!method EB(size)
      #
      # Create {DiskSize} object in EB (10^18) units.
      #
      # @param size [Float]
      # @return [DiskSize]
      #
      # @example These are 16 EB
      #   DiskSize.EB(16)   #=> <DiskSize 13.88 EiB (16000000000000000000)>

      # @!method ZiB(size)
      #
      # Create {DiskSize} object in ZiB (2**70) units.
      #
      # @param size [Float]
      # @return [DiskSize]
      #
      # @example These are 16 ZiB
      #   DiskSize.ZiB(16)   #=> <DiskSize 16.00 ZiB (18889465931478580854784)>

      # @!method ZB(size)
      #
      # Create {DiskSize} object in ZB (10^21) units.
      #
      # @param size [Float]
      # @return [DiskSize]
      #
      # @example These are 16 ZB
      #   DiskSize.ZB(16)   #=> <DiskSize 13.55 ZiB (16000000000000000000000)>

      # @!method YiB(size)
      #
      # Create {DiskSize} object in YiB (2**80) units.
      #
      # @param size [Float]
      # @return [DiskSize]
      #
      # @example These are 16 YiB
      #   DiskSize.YiB(16)   #=> <DiskSize 16.00 YiB (19342813113834066795298816)>

      # @!method YB(size)
      #
      # Create {DiskSize} object in YB (10^24) units.
      #
      # @param size [Float]
      # @return [DiskSize]
      #
      # @example These are 16 YB
      #   DiskSize.YB(16)   #=> <DiskSize 13.23 YiB (16000000000000000000000000)>

      # Define an initializer method for each unit:
      # @see DiskSize::UNITS and DiskSize::SI_UNITS.
      #
      # Examples:
      #
      # DiskSize.MiB(10)  #=> new DiskSize of 10 MiB
      # DiskSize.MB(10)   #=> new DiskSize of 10 MB
      (UNITS + SI_UNITS).each do |unit|
        define_method(unit) { |v| DiskSize.new(calculate_bytes(v, unit)) }
      end

      # Create {DiskSize} object of unlimited size.
      #
      # @return [DiskSize]
      #
      # @example Unlimited (infinite) size
      #   DiskSize.unlimited   #=> <DiskSize <unlimited> (-1)>
      #
      def unlimited
        DiskSize.new(-1)
      end

      # Create {DiskSize} object of zero size.
      #
      # @return [DiskSize]
      #
      # @example Zero (0) size
      #   DiskSize.zero   #=> <DiskSize 0.00 B (0)>
      #
      def zero
        DiskSize.new(0)
      end

      # Total sum of all sizes in an +Array+.
      #
      # If the optional argument +rounding+ is used, every size will be
      # rounded up.
      #
      # @see ceil
      #
      # @param sizes [Array<DiskSize>] array of {DiskSize} objects to sum
      # @param rounding [DiskSize, nil]
      # @return [DiskSize] sum of all the sizes
      #
      # @example
      #   x = DiskSize.KiB(1)       #=> <DiskSize 1.00 KiB (1024)>
      #   DiskSize.sum([x, x, x])   #=> <DiskSize 3.00 KiB (3072)>
      #
      def sum(sizes, rounding: nil)
        rounding ||= DiskSize.new(1)
        sizes.reduce(DiskSize.zero) { |sum, size| sum + size.ceil(rounding) }
      end

      # Create a {DiskSize} from a parsed string.
      #
      # @param str [String]
      # @param legacy_units [Boolean] if true, International System units
      #   are considered as base 2 units, that is, MB is the same than MiB.
      #
      # @return [DiskSize]
      #
      # Valid format:
      #
      # NUMBER [UNIT] [(COMMENT)] | unlimited
      #
      # A floating point number, optionally followed by a binary unit (e.g. 'GiB'),
      # optionally followed by a comment in parentheses (which is ignored).
      # Alternatively, the string 'unlimited' represents an infinite size.
      #
      # If UNIT is missing, 'B' (bytes) is assumed.
      #
      # @example
      #   DiskSize.parse("42 GiB")              #=> <DiskSize 42.00 GiB (45097156608)>
      #   DiskSize.parse("42.00  GiB")          #=> <DiskSize 42.00 GiB (45097156608)>
      #   DiskSize.parse("42 GB")               #=> <DiskSize 39.12 GiB (42000000000)>
      #   DiskSize.parse("42GB")                #=> <DiskSize 39.12 GiB (42000000000)>
      #   DiskSize.parse("512")                 #=> <DiskSize 0.50 KiB (512)>
      #   DiskSize.parse("0.5 YiB (512 ZiB)")   #=> <DiskSize 0.50 YiB (604462909807314587353088)>
      #   DiskSize.parse("1024MiB(1 GiB)")      #=> <DiskSize 1.00 GiB (1073741824)>
      #   DiskSize.parse("unlimited")           #=> <DiskSize <unlimited> (-1)>
      #
      def parse(str, legacy_units: false)
        str = sanitize(str)
        return DiskSize.unlimited if str == UNLIMITED

        bytes = str_to_bytes(str, legacy_units: legacy_units)
        DiskSize.new(bytes)
      end

      # Create a {DiskSize} from a parsed string but returns a fallback when the string is not valid
      #
      # The parse method raises an exception when the given string does not
      # correspond to a valid size. This method returns a fallback value
      # instead of raising an exception.
      #
      # @example
      #   DiskSize.parse_or("42 GiB")                             #=> <DiskSize 42.00 GiB (45097156608)>
      #   DiskSize.parse_or("GiB")                                #=> nil
      #   DiskSize.parse_or("GiB", DiskSize.unlimited)            #=> <DiskSize <unlimited> -1>
      #   DiskSize.parse_or("1GB", legacy_units: true)            #=> <DiskSize 1.00 GiB (1073741824)>
      #
      # @param str [String] String representing a size
      # @param fallback [Object] Fallback value to return when parsing failed
      # @param legacy_units [Boolean] if true, International System units
      #   are considered as base 2 units, that is, MB is the same than MiB.
      # @return [DiskSize]
      #
      # @see .parse
      def parse_or(str, fallback = nil, legacy_units: false)
        parse(str, legacy_units: legacy_units)
      rescue TypeError
        fallback
      end

      alias_method :from_s, :parse
      alias_method :from_human_string, :parse

      private

      # Ignore everything added in parentheses, so we can also parse the output of #to_s
      def sanitize(str)
        str.gsub(/\(.*/, "").strip
      end

      def str_to_bytes(str, legacy_units: false)
        number = number(str).to_f
        unit = unit(str)
        return number if unit.empty?

        calculate_bytes(number, unit, legacy_units: legacy_units)
      end

      def number(str)
        number = str.scan(/^[+-]?\d+\.?\d*/).first
        raise TypeError, "Not a number: #{str}" if number.nil?

        number
      end

      # Include all units for comparison
      ALL_UNITS = (UNITS + DEPRECATED_UNITS + SI_UNITS).freeze

      def unit(str)
        unit = str.gsub(number(str), "").strip
        return "" if unit.empty?

        unit = ALL_UNITS.find { |v| v.casecmp(unit).zero? }
        raise TypeError, "Bad disk size unit: #{str}" if unit.nil?

        unit
      end

      def calculate_bytes(number, unit, legacy_units: false)
        if UNITS.include?(unit)
          base = 1024
          exp = UNITS.index(unit)
        elsif SI_UNITS.include?(unit)
          base = 1000
          exp = SI_UNITS.index(unit) + 1
        elsif DEPRECATED_UNITS.include?(unit)
          base = 1000
          exp = DEPRECATED_UNITS.index(unit) + 1
        else
          raise TypeError, "Bad disk size unit: #{str}"
        end
        base = 1024 if legacy_units
        number * (base**exp)
      end
    end

    #
    # Operators
    #

    # Add a {DiskSize} object and another object. The other object must
    # be acceptable to {new}.
    #
    # @param other [Numeric, String, DiskSize]
    #
    # @return [DiskSize]
    #
    # @example
    #   x = DiskSize.MiB(3)      #=> <DiskSize 3.00 MiB (3145728)>
    #   y = DiskSize.KB(1)       #=> <DiskSize 0.98 KiB (1000)>
    #   x + 100                  #=> <DiskSize 3.00 MiB (3145828)>
    #   x + "1 MiB"              #=> <DiskSize 4.00 MiB (4194304)>
    #   x + y                    #=> <DiskSize 3.00 MiB (3146728)>
    #   x + DiskSize.unlimited   #=> <DiskSize <unlimited> (-1)>
    #   x + "unlimited"          #=> <DiskSize <unlimited> (-1)>
    #
    def +(other)
      return DiskSize.unlimited if any_operand_unlimited?(other)

      DiskSize.new(@size + DiskSize.new(other).to_i)
    end

    # Subtract a {DiskSize} object and another object. The other object
    # must be acceptable to {new}.
    #
    # @param other [Numeric, String, DiskSize]
    #
    # @return [DiskSize]
    #
    # @example
    #   x = DiskSize.MiB(3)      #=> <DiskSize 3.00 MiB (3145728)>
    #   y = DiskSize.KB(1)       #=> <DiskSize 0.98 KiB (1000)>
    #   x - 100                  #=> <DiskSize 3.00 MiB (3145628)>
    #   x - "1 MiB"              #=> <DiskSize 2.00 MiB (2097152)>
    #   x - y                    #=> <DiskSize 3.00 MiB (3144728)>
    #   # sizes can be negative
    #   y - x                    #=> <DiskSize -3.00 MiB (-3144728)>
    #   # but there's no "-unlimited"
    #   x - DiskSize.unlimited   #=> <DiskSize <unlimited> (-1)>
    #
    def -(other)
      return DiskSize.unlimited if any_operand_unlimited?(other)

      DiskSize.new(@size - DiskSize.new(other).to_i)
    end

    # The remainder dividing a {DiskSize} object by another object. The
    # other object must be acceptable to {new}.
    #
    # @param other [Numeric, String, DiskSize]
    #
    # @return [DiskSize]
    #
    # @example
    #   x = DiskSize.MiB(3)   #=> <DiskSize 3.00 MiB (3145728)>
    #   y = DiskSize.KB(1)    #=> <DiskSize 0.98 KiB (1000)>
    #   x % 100               #=> <DiskSize 28.00 B (28)>
    #   X % "1 MB"            #=> <DiskSize 142.31 KiB (145728)>
    #   x % y                 #=> <DiskSize 0.71 KiB (728)>
    #
    def %(other)
      return DiskSize.unlimited if any_operand_unlimited?(other)

      DiskSize.new(@size % DiskSize.new(other).to_i)
    end

    # Multiply a {DiskSize} object by a +Numeric+ object.
    #
    # @param other [Numeric]
    #
    # @return [DiskSize]
    #
    # @example
    #   x = DiskSize.MiB(1)      #=> <DiskSize 1.00 MiB (1048576)>
    #   x * 3                    #=> <DiskSize 3.00 MiB (3145728)>
    #
    def *(other)
      raise TypeError, "Unexpected #{other.class}; expected Numeric value" if !other.is_a?(Numeric)

      return DiskSize.unlimited if unlimited?

      DiskSize.new(@size * other)
    end

    # Divide a {DiskSize} object by a +Numeric+ object.
    #
    # @param other [Numeric]
    #
    # @return [DiskSize]
    #
    # @example
    #   x = DiskSize.MiB(1)      #=> <DiskSize 1.00 MiB (1048576)>
    #   x / 3                    #=> <DiskSize 341.33 KiB (349525)>
    #
    def /(other)
      raise TypeError, "Unexpected #{other.class}; expected Numeric value" if !other.is_a?(Numeric)

      return DiskSize.unlimited if unlimited?

      DiskSize.new(@size.to_f / other)
    end

    #
    # Other methods
    #

    # Test if {DiskSize} is unlimited.
    #
    # @return [Boolean]
    #
    # @example
    #   x = DiskSize.GiB(10)   #=> <DiskSize 10.00 GiB (10737418240)>
    #   x.unlimited?           #=> false
    def unlimited?
      @size == -1
    end

    # Test if {DiskSize} is zero.
    #
    # @return [Boolean]
    #
    # @example
    #   x = DiskSize.GiB(10)   #=> <DiskSize 10.00 GiB (10737418240)>
    #   x.zero?                #=> false
    def zero?
      @size == 0
    end

    # Test if {DiskSize} (amount of bytes) is power of certain value
    #
    # @return [Boolean]
    #
    # @example
    #   x = DiskSize.KiB(4)   #=> <DiskSize 4.00 KiB (4096)>
    #   x.power_of?(2)        #=> true
    #   x.power_of?(10)       #=> false
    #
    #   x = DiskSize.KB(100)  #=> <DiskSize 97.66 KiB (100000)>
    #   x.power_of?(2)        #=> false
    #   x.power_of?(10)       #=> true
    def power_of?(exp)
      return false if unlimited?

      (Math.log(size, exp) % 1).zero?
    end

    # Compare two {DiskSize} objects.
    #
    # @return [Integer]
    #
    # @note The Comparable mixin will get us operators < > <= >= == != with this.
    #
    # @example
    #   x = DiskSize.GiB(10)   #=> <DiskSize 10.00 GiB (10737418240)>
    #   y = DiskSize.GB(10)    #=> <DiskSize 9.31 GiB (10000000000)>
    #   x <=> y                #=> 1
    #   x > y                  #=> true
    def <=>(other)
      if other.respond_to?(:unlimited?) && other.unlimited?
        return unlimited? ? 0 : -1
      end
      return 1 if unlimited?
      return @size <=> other.size if other.respond_to?(:size)

      raise TypeError, "Unexpected #{other.class}; expected DiskSize"
    end

    # Round up the size to the next value that is divisible by
    # a given size. Return the same value if it's already divisible.
    #
    # @param unit_size [DiskSize]
    # @return [DiskSize]
    #
    # @example
    #   x = DiskSize.KiB(10)   #=> <DiskSize 10.00 KiB (10240)>
    #   y = DiskSize.KB(1)     #=> <DiskSize 0.98 KiB (1000)>
    #   x.ceil(y)              #=> <DiskSize 10.74 KiB (11000)>
    def ceil(unit_size)
      new_size = floor(unit_size)
      new_size += unit_size if new_size != self
      new_size
    end

    # Round down the size to the previous value that is divisible
    # by a given size. Return the same value if it's already divisible.
    #
    # @param unit_size [DiskSize]
    # @return [DiskSize]
    #
    # @example
    #   x = DiskSize.KiB(10)   #=> <DiskSize 10.00 KiB (10240)>
    #   y = DiskSize.KB(1)     #=> <DiskSize 0.98 KiB (1000)>
    #   x.floor(y)             #=> <DiskSize 9.77 KiB (10000)>
    def floor(unit_size)
      return DiskSize.new(@size) unless can_be_rounded?(unit_size)

      modulo = @size % unit_size.to_i
      DiskSize.new(@size - modulo)
    end

    # Human-readable string. That is, represented in the biggest unit ("MiB",
    # "GiB", ...) that makes sense, even if it means losing some precision.
    #
    # *rounding_method*:
    #
    # - `:round` - the default
    #
    # - `:floor` (available as {#human_floor}) -
    # If we have 4.999 GiB of space, and ask the user how much of that
    # should be used, prefilling the "Size" widget with the maximum
    # rounded up to "5.00 GiB" it will then fail validation
    # (checking that the entered value fits in the available space)
    # We must round down.
    #
    # - `:ceil` (available as {#human_ceil}) -
    # (This seems unnecessary because actual minimum sizes
    # have few significant digits, but we provide it for symmetry)
    #
    # @param rounding_method [:round,:floor,:ceil] how to round
    # @return [String]
    #
    # @example
    #   x = DiskSize.KB(1)   #=> <DiskSize 0.98 KiB (1000)>
    #   x.to_human_string    #=> "0.98 KiB"
    #
    #   smaller = DiskSize.new(4095)  #=> <DiskSize 4.00 KiB (4095)>
    #   smaller.to_human_string       #=> "4.00 KiB"
    #   smaller.human_floor           #=> "3.99 KiB"
    #
    #   larger = DiskSize.new(4097)   #=> <DiskSize 4.00 KiB (4097)>
    #   larger.to_human_string        #=> "4.00 KiB"
    #   larger.human_ceil             #=> "4.01 KiB"
    #
    # @see human_floor
    # @see human_ceil
    def to_human_string(rounding_method: :round)
      return "unlimited" if unlimited?

      float, unit_s = human_string_components
      rounded = (float * 100).public_send(rounding_method) / 100.0
      # A plain "#{rounded} #{unit_s}" would not keep trailing zeros
      format("%.2f %s", rounded, unit_s)
    end

    # to_human_string(rounding_method: :floor)
    # @return [String]
    # @see to_human_string
    def human_floor
      to_human_string(rounding_method: :floor)
    end

    # to_human_string(rounding_method: :ceil)
    # @return [String]
    # @see to_human_string
    def human_ceil
      to_human_string(rounding_method: :ceil)
    end

    # Exact value + human readable in parentheses (if the latter makes sense).
    #
    # The result can be passed to {new} or {parse} to get a {DiskSize} object of the same size.
    #
    # @return [String]
    #
    # @example
    #   x = DiskSize.KB(1)     #=> <DiskSize 0.98 KiB (1000)>
    #   x.to_s                 #=> "1000 B (0.98 KiB)"
    #   DiskSize.new(x.to_s)   #=> "1000 B (0.98 KiB)"
    def to_s
      return "unlimited" if unlimited?

      size1, unit1 = human_string_components
      size2, unit2 = string_components
      v1 = format("%.2f %s", size1, unit1)
      v2 = "#{(size2 % 1 == 0) ? size2.to_i : size2} #{unit2}"
      # if both units are the same, just use exact value
      (unit1 == unit2) ? v2 : "#{v2} (#{v1})"
    end

    # Human readable + exact values in brackets for debugging or logging.
    #
    # @return [String]
    #
    # @example
    #   x = DiskSize.KB(1)   #=> <DiskSize 0.98 KiB (1000)>
    #   x.inspect            #=> "<DiskSize 0.98 KiB (1000)>"
    def inspect
      return "<DiskSize <unlimited> (-1)>" if unlimited?

      "<DiskSize #{to_human_string} (#{to_i})>"
    end

    # Used by ruby's +PP+ class.
    #
    # @return [nil]
    #
    # @example
    #   require "pp"
    #   x = DiskSize.KB(1)   #=> <DiskSize 0.98 KiB (1000)>
    #   pp x                 # print "<DiskSize 0.98 KiB (1000)>"
    def pretty_print(*)
      print inspect
    end

    private

    # Return 'true' if either self or other is unlimited.
    #
    def any_operand_unlimited?(other)
      return true if unlimited?
      return true if other.respond_to?(:unlimited?) && other.unlimited?

      other.respond_to?(:to_s) && other.to_s == "unlimited"
    end

    # Checks whether makes sense to round the value to the given size
    def can_be_rounded?(unit_size)
      return false if unit_size.unlimited? || unit_size.zero? || unit_size.to_i == 1

      !unlimited? && !zero?
    end

    # Return numeric size and unit ("MiB", "GiB", ...) in human-readable form
    #
    # @return [Array] [size, unit]
    def human_string_components
      return [UNLIMITED, ""] if @size == -1

      unit_index = 0
      # prefer 0.50 MiB over 512 KiB
      size2 = @size * 2

      while size2.abs >= 1024.0 && unit_index < UNITS.size - 1
        size2 /= 1024.0
        unit_index += 1
      end
      [size2 / 2.0, UNITS[unit_index]] # FIXME: Make unit translatable
    end

    # Return numeric size and unit ("MiB", "GiB", ...).
    # Unlike #human_string_components, always return the exact value.
    #
    # @return [Array] [size, unit]
    def string_components
      return [UNLIMITED, ""] if @size == -1

      unit_index = 0
      # allow half values
      size2 = @size * 2

      while size2 != 0 && (size2 % 1024) == 0 && unit_index < UNITS.size - 1
        size2 /= 1024
        unit_index += 1
      end
      [size2 / 2.0, UNITS[unit_index]]
    end
  end
end
