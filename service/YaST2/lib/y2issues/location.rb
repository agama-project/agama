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

module Y2Issues
  # Represent the location of an error
  #
  # It can be a file, a section of an AutoYaST profile, etc. This class is rather open and
  # its API might change once we know more about error reporting.
  #
  # The concept of "location" is introduce to tell the user where to look for a problem and as
  # a mechanism to group the issues.
  #
  # A location is composed by three parts:
  #
  # * type: whether the location is a file, an AutoYaST profile section, etc.
  # * path: location path (file path, AutoYaST profile path, etc.)
  # * id: it can be the file line, a key, an AutoYaST element name, etc. This element is optional.
  class Location
    # @return [String] Location type ("file", "autoyast", etc.)
    attr_reader :type
    # @return [String] Location path (a file path, an AutoYaST section path, and so on)
    attr_reader :path
    # @return [String,nil] Location ID within the path
    attr_reader :id

    # Parse a string and creates a location
    #
    # The string contains the type, the path and the id, separated by colons.
    #
    # @example AutoYaST section reference
    #   location = Location.parse("autoyast:partitioning,1,partition,0:filesystem_type")
    #   location.type #=> "ay"
    #   location.path #=> "partitioning,1,partition,0"
    #   location.id   #=> "filesystem_type"
    #
    # @example File reference
    #   location = Location.parse("file:/etc/sysconfig/network/ifcfg-eth0:BOOTPROTO")
    #   location.type #=> "file"
    #   location.path #=> "/etc/sysconfig/network/ifcfg-eth0"
    #   location.id   #=> "BOOTPROTO"
    #
    # @param str [String] String representing the path
    # @return [Location]
    # @see #to_s
    def self.parse(str)
      type, path, id = str.split(":")
      new(type, path, id)
    end

    # @param type [String] Location type
    # @param path [String] Location path
    # @param id   [String,nil] Location ID, if needed
    def initialize(type, path, id = nil)
      @type = type
      @path = path
      @id = id
    end

    # Returns a string-based representation of the location
    #
    # @return [String] String-based representation
    # @see .parse
    def to_s
      [type, path, id].compact.join(":")
    end

    # Determines whether two locations are the same
    #
    # @param other [Location]
    # @return [Boolean]
    def ==(other)
      type == other.type && path == other.path && id == other.id
    end

    alias_method :eql?, :==
  end
end
