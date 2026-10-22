# Copyright (c) [2020] SUSE LLC
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

module Installation
  module AutoinstProfile
    # This class represents an element path in a profile
    #
    # @example Create a path
    #   ElementPath.new("groups", 0, "groupname")
    #
    # @example Join a path and a string
    #   first = ElementPath.new("users", 1)
    #   first.join("username").to_s #=> "users,1,username"
    class ElementPath
      extend Forwardable

      def_delegators :@parts, :first, :last

      class << self
        # Returns an ElementPath object from a string
        #
        # @example Path to the username of the first user
        #   ElementPath.from_string("users,0,username")
        #
        # @param str [String] String to parse
        # @return [ElementPath] Profile path
        def from_string(str)
          parts = str.split(",").each_with_object([]) do |part, all|
            element = (part =~ /\A\d+\Z/) ? part.to_i : part
            all.push(element)
          end
          new(*parts)
        end
      end

      # Constructor
      #
      # @param parts [Array<Integer,String>] Profile path parts
      def initialize(*parts)
        @parts = parts
      end

      # Returns the path parts
      #
      # @return [Array<Integer,String>] An array containing the path parts
      def to_a
        @parts
      end

      # Returns a new path composed by the given parts
      #
      # @example Extend a path with an string
      #   path = ProfilePath.new("general")
      #   path.join("mode") #=> ProfilePath.new("general", "mode")
      #
      # @example Combine ProfilePath and strings
      #   path = ProfilePath.new("general")
      #   suffix = ProfilePath.new("mode")
      #   path.join(suffix, "confirm") #=> ProfilePath.new("general", "mode", "confirm")
      #
      # @param parts_or_path [Array<String,ProfilePath>] Parts or paths to join
      # @return [ElementPath] New element path
      def join(*parts_or_path)
        new_parts = parts_or_path.reduce([]) do |all, element|
          new_elements = element.respond_to?(:to_a) ? element.to_a : [element]
          all + new_elements
        end

        self.class.new(*(@parts + new_parts))
      end

      # Compares two paths
      #
      # Two paths are considered to be equivalent if they have the same parts.
      #
      # @param other [ElementPath] Element path to compare with
      # @return [Boolean] true if they are equal; false otherwise
      def ==(other)
        @parts == other.to_a
      end

      # Returns a generic path (old AutoYaST path used in ask-lists)
      #
      # @example Path to the first user in the list
      #   path = ElementPath.new("users", 1, "username")
      #   path.to_s #=> "users,1,username"
      #
      # @return [String]
      def to_s
        @parts.join(",")
      end
    end
  end
end
