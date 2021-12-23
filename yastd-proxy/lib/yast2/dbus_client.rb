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

require "cheetah"

module Yast2
  class DBusClient
    SERVICE_NAME = "org.opensuse.YaST"
    OBJECT_PATH = "/org/opensuse/YaST/Installer"
    IFACE = "org.opensuse.YaST.Installer"
    PROPERTIES_IFACE = "org.freedesktop.DBus.Properties"

    class CouldNotSetProperty < StandardError; end

    # Returns the installer properties
    #
    # @return [Array<Hash<String,Object>>] Returns the installer properties
    def get_properties
      output = Cheetah.run(
        "busctl", "call", "--json=short", SERVICE_NAME, OBJECT_PATH, PROPERTIES_IFACE,
        "GetAll", "s", IFACE, stdout: :capture
      )
      data_from_output(output)
    end

    # Returns a property value
    #
    # @param name [String] Property name
    # @return [Object] Property value
    def get_property(name)
      output = Cheetah.run(
        "busctl", "get-property", "--json=short", SERVICE_NAME, OBJECT_PATH, IFACE, name,
        stdout: :capture
      )
      data_from_output(output)
    end

    # Sets a property value
    #
    # @param name [String] Property name
    # @param value [String] Property value
    # @raise CouldNotSetProperty
    def set_property(name, value)
      Cheetah.run(
        "busctl", "set-property", SERVICE_NAME, OBJECT_PATH, IFACE, name, "s", value
      )
    rescue Cheetah::ExecutionFailed => e
      raise CouldNotSetProperty, e.stderr
    end

    # Calls a method from the installer D-Bus interface
    #
    # @param meth [String] Method name
    # @param args [Array<String>] Method arguments
    def call(meth, args = [])
      output = Cheetah.run(
        "busctl", "call", "--json=short", SERVICE_NAME, OBJECT_PATH, IFACE, meth, *args, stdout: :capture
      )
      data_from_output(output)
    end

  private

    # FIXME: Improve the code to handle nested structures
    def data_from_output(output)
      json = JSON.parse(output)
      extract_data_from_node(json)
    end

    # FIXME: simplify the algorithm
    def extract_data_from_node(node)
      return node unless node.is_a?(Enumerable)

      return extract_data_from_array(node) if node.is_a?(Array)

      case node["data"]
      when Array
        extract_data_from_array(node["data"])
      when Hash
        extract_data_from_node(node["data"])
      when String, Integer
        node["data"]
      else
        node.reduce({}) do |all, (key, value)|
          all.merge(key => extract_data_from_node(value))
        end
      end
    end

    def extract_data_from_array(array)
      array.map { |e| extract_data_from_node(e) }
    end
  end
end
