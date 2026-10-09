# Copyright 2014 SUSE, LLC

require "yast"

module Yast
  # A drop-in replacement of an earlier Perl implementation
  #
  # @note This is legacy code ported from the
  # {https://news.opensuse.org/2007/08/29/yast-independence-of-ycp/ YCP} era. Its use is highly
  # discouraged in favor of the {https://ruby-doc.org/stdlib-3.0.2/libdoc/uri/rdoc/URI.html URI}
  # standard library or the new {Y2Packager::ZyppUrl} (available from SLE-15-SP3 on) when working
  # with libzypp URLs.
  class URLRecodeClass < Module
    # these will be substituted to a regex character class
    USERNAME_PASSWORD_FRAGMENT_SAFE_CHARS = "-A-Za-z0-9_.!~*'()".freeze
    PATH_SAFE_CHARS =                       "-A-Za-z0-9_.!~*'()/:$".freeze
    QUERY_SAFE_CHARS =                      "-A-Za-z0-9_.!~*'()/:=&".freeze

    # Escape password, user name and fragment part of URL string
    # @param [String] input input string
    # @return [String] Escaped string
    def EscapePassword(input)
      escape(input, USERNAME_PASSWORD_FRAGMENT_SAFE_CHARS)
    end

    # Escape path part of URL string
    # @param [String] input input string
    # @return [String] Escaped string
    def EscapePath(input)
      escape(input, PATH_SAFE_CHARS)
    end

    # Escape path part of URL string
    # @param [String] input input string
    # @return [String] Escaped string
    def EscapeQuery(input)
      escape(input, QUERY_SAFE_CHARS)
    end

    # UnEscape an URL string, replace %<Hexnum><HexNum> sequences
    # by character
    # @param [String] input input string
    # @return [String] Unescaped string
    def UnEscape(input)
      input.gsub(/%([0-9A-Fa-f]{2})/) { Regexp.last_match[1].to_i(16).chr }.force_encoding(input.encoding)
    end

  private

    def escape(input, safe_chars)
      return nil if input.nil?

      input.gsub(/[^#{safe_chars}]/) do |unicode_char|
        escaped = ""
        unicode_char.each_byte { |b| escaped << format("%%%02x", b) }
        escaped
      end
    end

    publish function: :EscapePassword, type: "string (string)"
    publish function: :EscapePath,     type: "string (string)"
    publish function: :EscapeQuery,    type: "string (string)"
    publish function: :UnEscape,       type: "string (string)"
  end

  URLRecode = URLRecodeClass.new
end
