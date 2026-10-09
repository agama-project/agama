# ***************************************************************************
#
# Copyright (c) 2002 - 2012 Novell, Inc.
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of version 2 of the GNU General Public License as
# published by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.   See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, contact Novell, Inc.
#
# To contact Novell about this file by physical or electronic mail,
# you may find current contact information at www.novell.com
#
# ***************************************************************************
# File:  modules/String.ycp
# Package:  yast2
# Summary:  String manipulation routines
# Authors:  Michal Svec <msvec@suse.cz>
#
# $Id$
require "yast"

module Yast
  class StringClass < Module
    include Yast::Logger

    # @note it is ascii chars only
    UPPER_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".freeze
    LOWER_CHARS = "abcdefghijklmnopqrstuvwxyz".freeze
    ALPHA_CHARS = UPPER_CHARS + LOWER_CHARS
    DIGIT_CHARS = "0123456789".freeze
    ALPHA_NUM_CHARS = ALPHA_CHARS + DIGIT_CHARS
    PUNCT_CHARS = "!\"\#$%&'()*+,-./:;<=>?@[\\]^_`{|}~".freeze
    GRAPHICAL_CHARS = ALPHA_NUM_CHARS + PUNCT_CHARS
    SPACE_CHARS = " \f\r\n\t\v".freeze
    PRINTABLE_CHARS = SPACE_CHARS + GRAPHICAL_CHARS

    def main
      textdomain "base"
    end

    # Quote a string with 's
    #
    # More precisely it protects single quotes inside the string but does not
    # prepend or append single quotes.
    #
    # @param [String] var unquoted string
    # @return quoted string
    # @example quote("a'b") -> "a'\''b"
    def Quote(var)
      return "" if var.nil?

      var.gsub("'", "'\\\\''")
    end

    # Return a pretty description of a byte count
    #
    # Return a pretty description of a byte count with required precision
    # and using B, KiB, MiB, GiB or TiB as unit as appropriate.
    #
    # Uses the current locale defined decimal separator
    # (i.e. the result is language dependant).
    #
    # @param [Fixnum] bytes  size (e.g. free diskspace, memory size) in Bytes
    # @param [Fixnum] precision number of fraction digits in output, if negative (less than 0) the precision is set automatically depending on the suffix
    # @param [Boolean] omit_zeroes if true then do not add zeroes
    #  (useful for memory size - 128 MiB RAM looks better than 128.00 MiB RAM)
    # @return formatted string
    #
    # @example FormatSizeWithPrecision(128, 2, true) -> "128 B"
    # @example FormatSizeWithPrecision(4096, 2, true) -> "4 KiB"
    # @example FormatSizeWithPrecision(4096, 2, false) -> "4.00 KiB"
    # @example FormatSizeWithPrecision(1024*1024, 2, true) -> "1 MiB"
    def FormatSizeWithPrecision(bytes, precision, omit_zeroes)
      return "" if bytes.nil?

      units = [
        # Byte abbreviated
        _("B"),
        # KiloByte abbreviated
        _("KiB"),
        # MegaByte abbreviated
        _("MiB"),
        # GigaByte abbreviated
        _("GiB"),
        # TeraByte abbreviated
        _("TiB")
      ]

      index = 0
      whole = bytes.to_f

      while (whole >= 1024.0 || whole <= -1024.0) && (index + 1) < units.size
        whole /= 1024.0
        index += 1
      end

      precision ||= 0
      # auto precision - depends on the suffix, but max. 3 decimal digits
      precision = (index < 3) ? index : 3 if precision < 0

      if omit_zeroes == true
        max_difference = 0.9
        max_difference /= (10.0 * precision)

        precision = 0 if (whole - whole.round).abs < max_difference
      end

      Builtins::Float.tolstring(whole, precision) + " " + units[index]
    end

    # Return a pretty description of a byte count
    #
    # Return a pretty description of a byte count, with two fraction digits
    # and using B, KiB, MiB, GiB or TiB as unit as appropriate.
    #
    # Uses the current locale defined decimal separator
    # (i.e. the result is language dependant).
    #
    # @param [Fixnum] bytes  size (e.g. free diskspace) in Bytes
    # @return formatted string
    #
    # @example FormatSize(23456767890) -> "223.70 MiB"
    def FormatSize(bytes)
      return "" unless bytes

      # automatic precision, don't print trailing zeroes for sizes < 1MiB
      FormatSizeWithPrecision(bytes, -1, Ops.less_than(bytes, 1 << 20))
    end

    # Remove spaces and tabs at begin and end of input string.
    # @param [String] input string to be stripped
    # @return stripped string
    # @deprecated if remove also \n then use {::String#strip}, otherwise simple sub is enough
    # @example CutBlanks("  \tany  input     ") -> "any  input"
    def CutBlanks(input)
      return "" if input.nil?

      input.sub(/\A[ \t]*(.*[^ \t])[ \t]*\z/, "\\1")
    end

    # Repeat a string
    #
    # Repeat a string number of times.
    #
    # @param input string to repeat
    # @param input number number of repetitions
    # @return [String] repeated string
    # @deprecated use {::String#operator*} instead
    def Repeat(text, number)
      return "" if text.nil? || number.nil? || number < 1

      text * number
    end


    # Remove first or every match of given regular expression from a string
    #
    # (e.g. CutRegexMatch( "abcdef12ef34gh000", "[0-9]+", true ) -> "abcdefefgh",
    # CutRegexMatch( "abcdef12ef34gh000", "[0-9]+", false ) -> "abcdefef34gh000")
    #
    # @param [String] input string that might occur regex
    # @param [String] regex regular expression to search for, must not contain brackets
    # @param [Boolean] glob flag if only first or every occuring match should be removed
    # @return [String] that has matches removed
    def CutRegexMatch(input, regex, glob)
      return "" if input.nil? || input.empty?

      output = input
      if Builtins.regexpmatch(output, regex)
        p = Builtins.regexppos(output, regex)
        loop do
          first_index = p[0]
          lenght = p[1] || 0

          output = output[0, first_index] + output[(first_index + lenght)..-1]
          p = Builtins.regexppos(output, regex)
          break unless glob
          break if p.empty?
        end
      end
      output
    end

    # Shorthand for select (splitstring (s, separators), 0, "")
    # Useful now that the above produces a deprecation warning.
    # @param [String] string to be split
    # @param [String] separators characters which delimit components
    # @return first component or ""
    def FirstChunk(string, separators)
      return "" if !string || !separators

      string[/\A[^#{separators}]*/]
    end

    # Replace substring in a string. All substrings source are replaced by string target.
    # @param [String] input string
    # @param [String] source the string which will be replaced
    # @param [String] target the new string which is used instead of source
    # @return [String] result
    def Replace(input, source, target)
      return nil if input.nil?

      if source.nil? || source == ""
        Builtins.y2warning("invalid parameter source: %1", source)
        return input
      end

      if target.nil?
        Builtins.y2warning("invalid parameter target: %1", target)
        return input
      end

      # avoid infinite loop even if it break backward compatibility
      raise "Target #{target} include #{source} which will lead to infinite loop" if target.include?(source)

      pos = input.index(source)
      while pos
        tmp = input[0, pos] + target
        tmp << input[(pos + source.size)..-1] if input.size > (pos + source.size)

        input = tmp

        pos = input.index(source)
      end

      input
    end

    # Format file name - truncate the middle part of the directory to fit to the reqested lenght.
    # Path elements in the middle of the string are replaced by ellipsis (...).
    # The result migth be longer that requested size if size of the last element
    # (with ellipsis) is longer than the requested size. If the requested size is greater than
    # size of the input then the string is not modified. The last part (file name) is never removed.
    #
    # @example FormatFilename("/really/very/long/file/name", 15) -> "/.../file/name"
    # @example FormatFilename("/really/very/long/file/name", 5) -> ".../name"
    # @example FormatFilename("/really/very/long/file/name", 100) -> "/really/very/long/file/name"
    #
    # @param [String] file_path file name
    # @param [Fixnum] len requested maximum lenght of the output
    # @return [String] Truncated file name
    def FormatFilename(file_path, len)
      return nil unless file_path
      return file_path if len && len > file_path.size

      dir = file_path.split("/", -1)
      file = dir.pop

      # there is a slash at the end, add the directory name
      file = dir.pop + "/" if file == ""

      if dir.join("/").size <= 3
        # the path is short, replacing by ... cannot help
        return file_path
      end

      ret = ""
      loop do
        # ellipsis - used to replace part of text to make it shorter
        # example: "/really/very/long/file/name", "/.../file/name")
        ellipsis = _("...")
        dir[dir.size / 2] = ellipsis

        ret = (dir + [file]).join("/")

        break unless len # funny backward compatibility that for nil len remove one element

        # the size is OK
        break if ret.size <= len

        # still too long, remove the ellipsis and start a new iteration
        dir.delete(ellipsis)

        break if dir.empty?
      end

      ret
    end

    publish function: :Quote, type: "string (string)"
    publish function: :FormatSizeWithPrecision, type: "string (integer, integer, boolean)"
    publish function: :FormatSize, type: "string (integer)"
    publish function: :CutBlanks, type: "string (string)"
    publish function: :Repeat, type: "string (string, integer)"
    publish function: :CutRegexMatch, type: "string (string, string, boolean)"
    publish function: :FirstChunk, type: "string (string, string)"
    publish function: :Replace, type: "string (string, string, string)"
    publish function: :FormatFilename, type: "string (string, integer)"

  end

  String = StringClass.new
  String.main
end
