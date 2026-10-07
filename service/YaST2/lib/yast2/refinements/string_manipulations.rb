# Copyright (c) [2019] SUSE LLC
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

module Yast2
  module Refinements
    # Default HTML tags replacements
    #
    # @see #plain_text
    # @return [Hash<String, String>]
    DEFAULT_HTML_TAGS_REPLACEMENTS = {
      "<br>"  => "\n",
      "<br/>" => "\n",
      "<br >" => "\n",
      "</li>" => "\n",
      "<ol>"  => "\n\n",
      "<ul>"  => "\n\n",
      "</p>"  => "\n\n"
    }.freeze

    # Refinements to make easier some string manipulations
    #
    # By using
    #   "<p>Just an <b>HTML</b> example to be formatted".plain_text.wrap_text
    # instead the helper alternative
    #   wrap_text(plain_text("<p>Just an <b>HTML</b> example to be formatted"))
    module StringManipulations
      refine String do
        # Get a new text version after ridding of HTML tags
        #
        # By default, a fully plain text will be returned, since some tags (see
        # {Yast2::Refinements::DEFAULT_HTML_TAGS_REPLACEMENTS}) are going to be replaced by line
        # breaks while the rest of them will be removed.
        #
        # The _tags_ param allows specifying which tags should be replaced or removed (keeping the rest
        # of them untouched).
        #
        # Replacements can be provided
        #   * as  tag => replacement collection via _replacements_ param, or
        #   * using a block to perform desired changes for each match (more flexible and powerful)
        #
        # Note that all matched tags without a replacement are going to be replaced with `nil`. In other
        # words, they will be deleted.
        #
        # @example Remove all HTML tags
        #   text = "<p>YaST:</p><p>a <b>powerful</b> installation and configuration tool.</p>"
        #   plain_text(text) #=> "YaST:\n\na powerful installation and configuration tool."
        #
        # @example Removing only the <p> tags
        #   text = "<p>YaST:</p><p>a <b>powerful</b> installation and configuration tool.</p>"
        #   plain_text(text, tags: ["p"])
        #   #=> "YaST:\n\na <b>powerful</b> installation and configuration tool."
        #
        # @example Using custom replacements via _replacements_ param
        #   text = "<p>YaST:</p><p>a <b>powerful</b> installation and configuration tool.</p>"
        #   plain_text(text, replacements: { "<p>" => "\n- ", "<b>" => "*", "</b>" => "*" })
        #     #=> "- YaST:\n- a *powerful* installation and configuration tool."
        #
        # @example Using custom replacements via block (will omit _replacements_ param)
        #   text = "<p>YaST:</p><p>a <b>powerful</b> installation and configuration tool.</p>"
        #   plain_text(text) do |tag|
        #     case tag
        #     when /<\/?p>/          then "\n"
        #     when /<\/?em>/         then "_"
        #     when /<\/?(b|strong)>/ then "*"
        #     end
        #   end
        #   #=> "- YaST:\n\na *powerful* installation and _configuration_ tool."
        #
        #   text = "<p>YaST is both" \
        #     "<ol>" \
        #     "<li>an extremely flexible installer</li>" \
        #     "<li>a powerful control center</li>" \
        #     "</ol>" \
        #     "</p>"
        #   plain_text(text) do |tag|
        #     case tag
        #     when "<ol>"
        #       @ordered = true
        #       @index = 0
        #       nil
        #     when "<ul>"
        #       @ordered = false
        #       nil
        #     when "<li>"
        #       marker = @ordered ? "#{@index += 1}." : "•"
        #       "\n  #{marker} "
        #     end
        #   end
        #   #=> "YaST is both\n  1. an extremely flexible installer\n  2. a powerful control center"
        #
        # @param tags [Array<String>] specific tags to be replaced or deleted
        # @param replacements [Hash<String, String>] a replacements dictionary, tag => replacement
        # @param block [Proc] a block in charge to perform the changes. When given, it does not make
        #   sense to specify _replacements_ param since the block has precedence over it.
        #
        # @return [String] the new version after ridding of undesired tags.
        def plain_text(tags: nil, replacements: nil, &block)
          regex = tags ? Regexp.union(tags.map { |t| /<[^>]*#{t}[^>]*>/i }) : /<.+?>/
          replacements ||= Refinements::DEFAULT_HTML_TAGS_REPLACEMENTS

          result = gsub(regex) do |match|
            tag = match.to_s.downcase

            block ? block.call(tag) : replacements[tag]
          end

          result.strip
        end

        # Wrap text breaking lines in the first whitespace that does not exceed given line width
        #
        # Additionally, it also allows retrieving only an excerpt of the wrapped text according to the
        # maximum number of lines indicated, adding one more with the cut_text text when it is given.
        #
        # @param line_width [Integer] max line length
        # @param n_lines [Integer, nil] the maximum number of lines
        # @param cut_text [String] the omission text to be used when the text should be cut
        #
        # @return [String]
        def wrap_text(line_width = 76, n_lines: nil, cut_text: "")
          return self if line_width > length

          wrapped_text = lines.collect! do |line|
            l = (line.length > line_width) ? line.gsub(/(.{1,#{line_width}})(?:\s+|$)/, "\\1\n") : line
            l.strip
          end

          result = wrapped_text.join("\n")
          result = result.head(n_lines, omission: cut_text) if n_lines
          result
        end

        # Returns only the first requested lines of the given text
        #
        # If the omission param is given, an extra line holding it will be included
        #
        # @param max_lines [Integer]
        # @param omission [String] the text to be added
        #
        # @return [String] the first requested lines if the text has more; full text otherwise
        def head(max_lines, omission: "")
          lines = self.lines

          return self if lines.length <= max_lines

          result = self.lines[0...max_lines]
          result << omission unless omission.empty?
          result.join
        end

        # Wrap a text in direction markers
        #
        # The text may contain tags and they will not be escaped.
        #
        # @param [String] language code (it gets the current one by default)
        # @return [String] wrapped text
        def div_with_direction(lang = nil)
          Yast.import "Language"
          lang ||= Yast::Language.language
          # RTL languages: Arabic, Persian, Hebrew
          direction = lang.start_with?("ar", "fa", "he") ? "rtl" : "ltr"
          "<div dir=\"#{direction}\">#{self}</div>"
        end
      end
    end
  end
end
