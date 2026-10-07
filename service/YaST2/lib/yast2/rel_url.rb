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

require "yast"
require "uri"

module Yast2
  # Class for working with relative URLs ("relurl://")
  class RelURL
    # @return [URI] the input base URL
    attr_reader :base

    # @return [URI] the input relative URL
    attr_reader :relative

    # Is the URL a relative URL?
    #
    # @param url [String, URI] the URL
    # @return [Boolean] `true` if the URL uses the "relurl" schema, otherwise `false`
    def self.relurl?(url)
      URI(url).scheme == "relurl"
    end

    # Create RelURL object with URL relative to the installation repository
    #
    # @param rel_url [String, URI] the relative URL, if non-relative URL is used
    #  then the result is this URL
    # @return [RelURL]
    #
    # @note Works properly only during installation/upgrade, do not use
    #   in an installed system.
    def self.from_installation_repository(rel_url)
      Yast.import "InstURL"
      base_url = Yast::InstURL.installInf2Url("")
      new(base_url, rel_url)
    end

    # Constructor
    #
    # @param base_url [String,URI] the base URL
    # @param rel_url [String,URI] the relative URL, it should use the "relurl://"
    #  schema otherwise the base URL is ignored
    def initialize(base_url, rel_url)
      @base = URI(base_url).dup
      @relative = URI(rel_url).dup

      preprocess_url(base)
      preprocess_url(relative)
    end

    # Build an absolute URL
    #
    # @param path [String,nil] optional URL subpath
    # @return [URI] the absolute URL
    #
    # @note It internally uses the Ruby `File.expand_path` function which
    # also evaluates the parent directory path ("../") so it is possible
    # to go up in the tree using the "relurl://../foo" or the "../foo" path
    # parameter.
    def absolute_url(path = nil)
      if (!relative.to_s.empty? && !RelURL.relurl?(relative)) || base.to_s.empty?
        ret = relative.dup
        relative_url = URI("")
      else
        ret = base.dup
        relative_url = relative.dup
      end

      relative_path = relative_url.path
      relative_path = File.join(relative_path, path) if path && !path.empty?

      base_path = ret.path
      if !base_path.empty? || !relative_path.empty?
        # the path would be expanded from the current working directory
        # by File.expand_path if the base path is not absolute
        base_path.prepend("/") if !base_path.start_with?("/")

        # escape the "~" character, it is treated as a home directory name by File.expand_path,
        # moreover it raises ArgumentError if that user does not exist in the system
        relative_path.gsub!("~", "%7E")
        # the relative path really needs to be relative, remove the leading slash(es)
        relative_path.sub!(/\A\/+/, "")

        absolute_path = File.expand_path(relative_path, base_path)
        # URI::FTP escapes the initial "/" to "%2F" which we do not want here
        absolute_path.sub!(/\A\/+/, "") if ret.scheme == "ftp"

        ret.path = absolute_path
      end

      ret
    end

  private

    # a helper method which fixes the URL path for the "file://" and "relurl://" URLs
    def preprocess_url(url)
      # move the host part to the path part for some URL types
      return unless ["file", "relurl"].include?(url.scheme) && url.host

      # URI requires absolute path
      url.path = File.join("/", url.host, url.path)
      url.host = nil
    end
  end
end
