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

    # Unquote a string with 's (quoted with quote)
    # @param [String] var quoted string
    # @return unquoted string
    # @see #quote
    def UnQuote(var)
      return "" if var.nil?

      log.debug "var=#{var}"

      var.gsub("'\\''", "'")
    end

    # Optional parenthesized text
    # @return " (Foo)" if Foo is neither empty or nil, else ""
    def OptParens(input)
      opt_format(" (%1)", input)
    end

    # @param [Array<String>] list of strings
    # @return only non-"" items
    def NonEmpty(list)
      return nil unless list

      list.reject { |i| i == "" }
    end

    # @param [String] string \n-terminated items
    # @return the items as a list, with empty lines removed
    def NewlineItems(string)
      return nil unless string

      NonEmpty(string.split("\n"))
    end

    # @param [Boolean] value boolean
    # @return [Boolean] value as "Yes" or "No"
    def YesNo(value)
      # TRANSLATORS: human text for Boolean value
      value ? _("Yes") : _("No")
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

    # Add a download rate status to a message.
    #
    # Add the current and the average download rate to the message.
    #
    # @param [String] text the message with %1 placeholder for the download rate string
    # @param [Fixnum] avg_bps average download rate (in B/s)
    # @param [Fixnum] curr_bps current download rate (in B/s)
    #
    # @return [String] formatted message
    def FormatRateMessage(text, avg_bps, curr_bps)
      rate = ""
      curr_bps ||= 0
      avg_bps ||= 0

      if curr_bps > 0
        rate = format_rate(curr_bps)

        if avg_bps > 0
          # format download rate message: %1 = the current download rate (e.g. "242.6kB/s")
          # %2 is the average download rate (e.g. "228.3kB/s")
          # to translators: keep translation of "on average" as short as possible
          rate = Builtins.sformat(
            _("%1 (on average %2)"),
            rate,
            format_rate(avg_bps)
          )
        end
      end

      # add download rate to the downloading message
      # %1 is URL, %2 is formatted download rate, e.g. "242.6kB/s (avg. 228.3kB/s)"
      # in ncurses UI the strings are exchanged (%1 is the rate, %2 is URL)
      # due to limited space on the screen
      Builtins.sformat(text, rate)
    end

    # Format an integer number as (at least) two digits; use leading zeroes if
    # necessary.
    # @param [Fixnum] input
    # @return [String] number as two-digit string
    #
    def FormatTwoDigits(input)
      msg = (0..9).member?(input) ? "0%1" : "%1"
      Builtins.sformat(msg, input)
    end

    # Format an integer seconds value with min:sec or hours:min:sec
    # @param [Fixnum] seconds time (in seconds)
    # @return [String] formatted string (empty for negative values)
    #
    def FormatTime(seconds)
      return "nil:nil:nil" unless seconds # funny backward compatibility
      return "" if seconds < 0

      if seconds < 3600 # Less than one hour
        Builtins.sformat(
          "%1:%2",
          FormatTwoDigits(seconds / 60),
          FormatTwoDigits(seconds % 60)
        ) # More than one hour - we don't hope this will ever happen, but who knows?
      else
        hours = seconds / 3600
        seconds = seconds % 3600
        Builtins.sformat(
          "%1:%2:%3",
          hours,
          FormatTwoDigits(seconds / 60),
          FormatTwoDigits(seconds % 60)
        )
      end
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

    # Remove any leading zeros
    #
    # Remove any leading zeros that make tointeger inadvertently
    # assume an octal number (e.g. "09" -> "9", "0001" -> "1",
    # but "0" -> "0")
    #
    # @param [String] input number that might contain leadig zero
    # @return [String] that has leading zeros removed
    # @deprecated if conversion to integer is needed in decimal use {::String#to_i}
    def CutZeros(input)
      return "" if input.nil?

      input.sub(/\A0*([0-9])/, "\\1")
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

    # Add the padding character around the text to make it long enough
    #
    # Add the padding character around the text to make it long enough. If the
    # text is longer than requested, no changes are made.
    #
    # @param [String] text text to be padded
    # @param [Fixnum] length requested length
    # @param [String] padding padding character
    # @param [Symbol] alignment alignment to use, either `left or `right
    # @return padded text
    def SuperPad(text, length, padding, alignment)
      text ||= ""
      return text if length.nil? || text.size >= length || padding.nil?

      pad = padding * (length - text.size)

      (alignment == :right) ? (pad + text) : (text + pad)
    end

    # Add spaces after the text to make it long enough
    #
    # Add spaces after the text to make it long enough. If the text is longer
    # than requested, no changes are made.
    #
    # @param [String] text text to be padded
    # @param [Fixnum] length requested length
    # @return padded text
    def Pad(text, length)
      SuperPad(text, length, " ", :left)
    end

    # Add zeros before the text to make it long enough.
    #
    # Add zeros before the text to make it long enough. If the text is longer
    # than requested, no changes are made.
    #
    # @param [String] text text to be padded
    # @param [Fixnum] length requested length
    # @return padded text
    def PadZeros(text, length)
      SuperPad(text, length, "0", :right)
    end

    # Parse string of values
    #
    # Parse string of values - split string to values, quoting and backslash sequences are supported
    # @param [String] options Input string
    # @param [Hash] parameters Parmeter used at parsing - map with keys:
    # "separator":<string> - value separator (default: " \t"),
    # "unique":<boolean> - result will not contain any duplicates, first occurance of the string is stored into output (default: false),
    # "interpret_backslash":<boolean> - convert backslash sequence into one character (e.g. "\\n" => "\n") (default: true)
    # "remove_whitespace":<boolean> - remove white spaces around values (default: true),
    # @return [Array<String>] List of strings
    def ParseOptions(options, parameters)
      parameters ||= {}
      ret = []

      # parsing options
      separator = parameters["separator"] || " \t"
      unique = parameters.fetch("unique", false)
      interpret_backslash = parameters.fetch("interpret_backslash", true)
      remove_whitespace = parameters.fetch("remove_whitespace", true)

      log.debug "Input: string: '#{options}', parameters: #{parameters}"

      return [] unless options

      # two algorithms are used:
      # first is much faster, but only usable if string
      # doesn't contain any double qoute characters
      # and backslash sequences are not interpreted
      # second is more general, but of course slower

      if options.include?("\"") && !interpret_backslash
        # easy case - no qouting, don't interpres backslash sequences => use splitstring
        values = options.split(/[#{separator}]/)

        values.each do |v|
          v = CutBlanks(v) if remove_whitespace == true
          ret << v if !unique || !ret.include?(v)
        end
      else
        # quoting is used or backslash interpretation is enabled
        # so it' not possible to split input
        # parsing each character is needed - use finite automaton

        # state
        state = :out_of_string
        # position in the input string
        index = 0
        # parsed value - buffer
        str = ""

        while index < options.size
          character = options[index]

          log.debug "character: #{character} state: #{state} index: #{index}"

          # interpret backslash sequence
          if character == "\\" && interpret_backslash
            nextcharacter = options[index + 1]
            if nextcharacter
              index += 1

              # backslah sequences
              backslash_seq = {
                "a"  => "\a", # alert
                "b"  => "\b", # backspace
                "e"  => "\e", # escape
                "f"  => "\f", # FF
                "n"  => "\n", # NL
                "r"  => "\r", # CR
                "t"  => "\t", # tab
                "v"  => "\v", # vertical tab
                "\\" => "\\", # backslash
                # backslash will be removed later,
                # double quote and escaped double quote have to be different
                # as it have different meaning
                "\"" => "\\\""
              }

              character = backslash_seq[nextcharacter] || nextcharacter

              log.debug "backslash sequence: '#{character}'"
            else
              log.warn "Missing character after backslash (\\) at the end of string"
            end
          end

          case state
          when :out_of_string
            # ignore separator or white space at the beginning of the string
            if separator.include?(character) || (remove_whitespace && character =~ /[ \t]/)
              index += 1
              next
            # start of a quoted string
            elsif character == "\""
              state = :in_quoted_string
            else
              # start of a string
              state = :in_string

              str = (character == "\\\"") ? "\"" : character
            end
          # after double quoted string - handle non-separator chars after double quote
          when :in_quoted_string_after_dblqt
            if separator.include?(character)
              ret << str if !unique || !Builtins.contains(ret, str)

              str = ""
              state = :out_of_string
            elsif character == "\\\""
              str << "\""
            else
              str << character
            end
          when :in_quoted_string
            case character
            when "\""
              # end of quoted string
              state = :in_quoted_string_after_dblqt
            when "\\\""
              str << "\""
            else
              str << character
            end
          when :in_string
            if separator.include?(character)
              state = :out_of_string

              str = CutBlanks(str) if remove_whitespace

              ret << str if !unique || !ret.include?(str)

              str = ""
            elsif character == "\\\""
              str << "\""
            else
              str << character
            end
          end

          index += 1
        end

        # error - still in quoted string
        if [:in_quoted_string, :in_quoted_string_after_dblqt].include?(state)
          log.warn "Missing trainling double quote character(\") in input: '#{options}'" if state == :in_quoted_string

          ret << str if !unique || !ret.include?(str)
        end

        # process last string in the buffer
        if state == :in_string
          str = CutBlanks(str) if remove_whitespace

          ret << str if !unique || !ret.include?(str)
        end
      end

      log.debug "Parsed values: #{ret}"

      ret
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

    # Function for escaping (replacing) (HTML|XML...) tags with their
    # (HTML|XML...) meaning.
    #
    # Usable to present text "as is" in RichText.
    #
    # @param [String] text to escape
    # @return [String]  escaped text
    def EscapeTags(text)
      return nil unless text

      text = text.dup

      text.gsub!("&", "&amp;")
      text.gsub!("<", "&lt;")
      text.gsub!(">", "&gt;")

      text
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

    # The 26 lowercase ASCII letters
    def CLower
      LOWER_CHARS
    end

    # The 52 upper and lowercase ASCII letters
    def CAlpha
      ALPHA_CHARS
    end

    # Digits: 0123456789
    def CDigit
      DIGIT_CHARS
    end

    # The 62 upper and lowercase ASCII letters and digits
    def CAlnum
      ALPHA_NUM_CHARS
    end

    # Printable ASCII charcters except whitespace, 33-126
    def CGraph
      GRAPHICAL_CHARS
    end

    # Printable ASCII characters including whitespace
    def CPrint
      PRINTABLE_CHARS
    end

    # Characters valid in a filename (not pathname).
    # Naturally "/" is disallowed. Otherwise, the graphical ASCII
    # characters are allowed.
    # @return [String] for ValidChars
    def ValidCharsFilename
      GRAPHICAL_CHARS.delete("/")
    end

    # Function creates text table without using HTML tags.
    # (Useful for commandline)
    # Undefined option uses the default one.
    #
    # @param [Array<String>] header
    # @param [Array<Array<String>>] items
    # @param [Hash{String => Object}] options
    # @return  [String] table
    #
    # Header: [ "Id", "Configuration", "Device" ]
    # Items: [ [ "1", "aaa", "Samsung Calex" ], [ "2", "bbb", "Trivial Trinitron" ] ]
    # Possible Options: horizontal_padding (for columns), table_left_padding (for table)
    def TextTable(header, items, options)
      options ||= {}
      items ||= []
      current_horizontal_padding = options["horizontal_padding"] || 2
      current_table_left_padding = options["table_left_padding"] || 4

      cols_lenghts = find_longest_records(Builtins.add(items, header))

      # whole table is left-padded
      table_left_padding = Pad("", current_table_left_padding)
      # the last row has no newline
      rows_count = items.size
      table = ""

      table << table_left_padding
      table << table_row(header, cols_lenghts, current_horizontal_padding)
      table << "\n"

      table << table_left_padding
      table << table_header_underline(cols_lenghts, current_horizontal_padding)
      table << "\n"

      items.each_with_index do |row, rows_counter|
        table << table_left_padding
        table << table_row(row, cols_lenghts, current_horizontal_padding)
        table << "\n" if (rows_counter + 1) < rows_count
      end
      table
    end

    # Function returns underlined text header without using HTML tags.
    # (Useful for commandline)
    #
    # @param  string header line
    # @param  integer left padding
    # @return  [String] underlined header line
    def UnderlinedHeader(header_line, left_padding)
      return nil unless header_line

      left_padding ||= 0

      Pad("", left_padding) + header_line + "\n" +
        Pad("", left_padding) + underline(header_line.size)
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

    # Make a random base-36 number.
    # srandom should be called beforehand.
    # @param [Fixnum] len string length
    # @return random string of 0-9 and a-z
    def Random(len)
      return "" if !len || len <= 0

      digits = DIGIT_CHARS + LOWER_CHARS # uses the character classes from above
      ret = Array.new(len) { digits[rand(digits.size)] }

      ret.join
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

    # Remove a shortcut from a label, so that it can be inserted into help
    # to avoid risk of different translation of the label
    # @param [String] label string a label possibly including a shortcut
    # @return [String] the label without the shortcut mark
    def RemoveShortcut(label)
      ret = label
      if Builtins.regexpmatch(label, "^(.*[^&])?(&&)*&[[:alnum:]].*$")
        ret = Builtins.regexpsub(
          label,
          "^((.*[^&])?(&&)*)&([[:alnum:]].*)$",
          "\\1\\4"
        )
      end
      ret
    end

    # Checks whether string str starts with test.
    def StartsWith(str, test)
      Builtins.search(str, test) == 0
    end

    # Find a mount point for given directory/file path. Returns "/" if no mount point matches
    # @param dir requested path , e.g. "/usr/share"
    # @param dirs list of mount points, e.g. [ "/", "/usr", "/boot" ]
    # @return string a mount point from the input list or "/" if not found
    def FindMountPoint(dir, dirs)
      dirs = deep_copy(dirs)
      while !dir.nil? && dir != "" && !Builtins.contains(dirs, dir)
        # strip the last path component and try it again
        comps = Builtins.splitstring(dir, "/")
        comps = Builtins.remove(comps, Ops.subtract(Builtins.size(comps), 1))
        dir = Builtins.mergestring(comps, "/")
      end

      dir = "/" if dir.nil? || dir == ""

      dir
    end

    publish function: :Quote, type: "string (string)"
    publish function: :UnQuote, type: "string (string)"
    publish function: :OptParens, type: "string (string)"
    publish function: :NonEmpty, type: "list <string> (list <string>)"
    publish function: :NewlineItems, type: "list <string> (string)"
    publish function: :YesNo, type: "string (boolean)"
    publish function: :FormatSizeWithPrecision, type: "string (integer, integer, boolean)"
    publish function: :FormatSize, type: "string (integer)"
    publish function: :FormatRateMessage, type: "string (string, integer, integer)"
    publish function: :FormatTime, type: "string (integer)"
    publish function: :CutBlanks, type: "string (string)"
    publish function: :CutZeros, type: "string (string)"
    publish function: :Repeat, type: "string (string, integer)"
    publish function: :SuperPad, type: "string (string, integer, string, symbol)"
    publish function: :Pad, type: "string (string, integer)"
    publish function: :PadZeros, type: "string (string, integer)"
    publish function: :ParseOptions, type: "list <string> (string, map)"
    publish function: :CutRegexMatch, type: "string (string, string, boolean)"
    publish function: :EscapeTags, type: "string (string)"
    publish function: :FirstChunk, type: "string (string, string)"
    publish function: :CLower, type: "string ()"
    publish function: :CAlpha, type: "string ()"
    publish function: :CDigit, type: "string ()"
    publish function: :CAlnum, type: "string ()"
    publish function: :CGraph, type: "string ()"
    publish function: :CPrint, type: "string ()"
    publish function: :ValidCharsFilename, type: "string ()"
    publish function: :TextTable, type: "string (list <string>, list <list <string>>, map <string, any>)"
    publish function: :UnderlinedHeader, type: "string (string, integer)"
    publish function: :Replace, type: "string (string, string, string)"
    publish function: :Random, type: "string (integer)"
    publish function: :FormatFilename, type: "string (string, integer)"
    publish function: :RemoveShortcut, type: "string (string)"
    publish function: :StartsWith, type: "boolean (string, string)"
    publish function: :FindMountPoint, type: "string (string, list <string>)"

  private

    # Optional formatted text
    # @return sformat (f, s) if s is neither empty or nil, else ""
    def opt_format(format, string)
      (string == "" || string.nil?) ? "" : Builtins.sformat(format, string)
    end

    # Return a pretty description of a download rate
    #
    # Return a pretty description of a download rate, with two fraction digits
    # and using B/s, KiB/s, MiB/s, GiB/s or TiB/s as unit as appropriate.
    #
    # @param [Fixnum] bytes_per_second download rate (in B/s)
    # @return formatted string
    #
    # @example format_rate(6780) -> ""
    # @example format_rate(0) -> ""
    # @example format_rate(895321) -> ""
    def format_rate(bytes_per_second)
      # covert a number to download rate string
      # %1 is string - size in bytes, B, KiB, MiB, GiB or TiB
      Builtins.sformat(_("%1/s"), FormatSize(bytes_per_second))
    end

    # Local function returns underline string /length/ long.
    #
    # @param  integer length of underline
    # @return  string /length/ long underline
    def underline(length)
      return "" unless length

      "-" * length
    end

    # Local function for creating header underline for table.
    # It uses maximal lengths of records defined in cols_lenghts.
    #
    # @param  list <integer> maximal lengths of records in columns
    # @param  integer horizontal padding of records
    # @return  string table header underline
    def table_header_underline(cols_lenghts, horizontal_padding)
      horizontal_padding ||= 0

      # count of added paddings
      records_count = cols_lenghts.size - 1
      # total length of underline
      total_size = 0

      cols_lenghts.each_with_index do |col_size, col_counter|
        total_size += col_size
        # adding padding where necessary
        total_size += horizontal_padding if col_counter < records_count
      end

      underline(total_size)
    end

    # Local function for finding longest records in the table.
    #
    # @param  list <list <string> > table items
    # @return  list <integer> longest records by columns
    def find_longest_records(items)
      return [] unless items

      # searching all rows
      items.each_with_object([]) do |row, result|
        next unless row

        row.each_with_index do |e, i|
          size = e ? e.size : 0
          result[i] ||= size
          result[i] = size if size > result[i]
        end
      end
    end

    # Local function creates table row.
    #
    # @param  list <string> row items
    # @param  list <integer> columns lengths
    # @param  integer record horizontal padding
    # @return  string padded table row
    def table_row(row_items, cols_lenghts, horizontal_padding)
      row = ""
      row_items ||= []

      records_count = row_items.size - 1

      row_items.each_with_index do |record, col_counter|
        padding = cols_lenghts[col_counter] || 0
        padding += horizontal_padding if col_counter < records_count

        row << Pad(record, padding)
      end

      row
    end
  end

  String = StringClass.new
  String.main
end
