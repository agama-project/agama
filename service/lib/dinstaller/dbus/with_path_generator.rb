# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

require "dbus/object_path"
require "pathname"

module DInstaller
  module DBus
    # Mixin for creating D-Bus path of dynamically exported objects
    #
    # @example
    #   class Test1
    #     include WithPathGenerator
    #     path_generator "/test1/objects"
    #   end
    #
    #   class Test2
    #     include WithPathGenerator
    #     path_generator "/test2", "object"
    #   end
    #
    #   test1.next_path #=> "/test1/objects/1"
    #   test1.next_path #=> "/test1/objects/2"
    #
    #   test2.next_path #=> "/test2/object1"
    #   test2.next_path #=> "/test2/object2"
    module WithPathGenerator
      # Generates the next based on the configuration of the path generator
      #
      # @return [::DBus::ObjectPath]
      def next_path
        self.class.next_path
      end

      def self.included(base)
        base.extend ClassMethods
      end

      # Define class methods
      module ClassMethods
        def next_path
          raise "path_generator not configured yet" unless @path_generator

          @path_generator.next
        end

        # Configures the path generator
        #
        # @param base_path [String]
        # @param base_name [String]
        def path_generator(base_path, base_name = "")
          @path_generator = PathGenerator.new(base_path, base_name)
        end

        # Class for generating an object path
        class PathGenerator
          def initialize(base_path, base_name)
            @base_path = base_path
            @base_name = base_name
          end

          def next
            path = Pathname.new(@base_path).join(@base_name + next_id.to_s)
            ::DBus::ObjectPath.new(path.to_s)
          end

        private

          # Generates the next id
          #
          # @return [Integer]
          def next_id
            @last_id ||= 0
            @last_id += 1
          end
        end
      end
    end
  end
end
