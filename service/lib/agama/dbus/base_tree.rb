# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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

require "dbus"

module Agama
  module DBus
    # Base class for a D-Bus tree exporting a collection of D-Bus objects
    #
    # @abstract Subclasses must define these methods:
    #   * {#create_dbus_object}
    #   * {#update_dbus_object}
    #   * {#dbus_object?}
    class BaseTree
      # Constructor
      #
      # @param service [::DBus::ObjectServer]
      # @param root_path [::DBus::ObjectPath] Root path of the tree
      # @param logger [Logger, nil]
      def initialize(service, root_path, logger: nil)
        @service = service
        @root_path = root_path
        @logger = logger
      end

      # Adds, updates or deletes D-Bus objects according to the given list of objects
      #
      # As result there is an exported D-Bus object for each object in the list.
      #
      # @param objects [Array]
      def objects=(objects)
        try_update_objects(objects)
        try_add_objects(objects)
        try_delete_objects(objects)
      end

      # Unexports the current D-Bus objects of this tree.
      def clean
        dbus_objects.each { |o| service.unexport(o) }
      end

    private

      # @return [::DBus::ObjectServer]
      attr_reader :service

      # @return [::DBus::ObjectPath]
      attr_reader :root_path

      # @return [Logger]
      attr_reader :logger

      # Returns the D-Bus object for the given object
      #
      # @param object [Object]
      # @return [DBus::BaseObject, nil]
      def find_dbus_object(object)
        dbus_objects.find { |o| dbus_object?(o, object) }
      end

      # Creates a D-Bus object for the given object
      #
      # @raise Must be defined by derived classes
      #
      # @param _object [Object]
      # @return [DBus::BaseObject]
      def create_dbus_object(_object)
        raise "Abstract method, derived classes must implement this"
      end

      # Updates the D-Bus object
      #
      # @raise Must be defined by derived classes
      #
      # @param _dbus_object [DBus::BaseObject]
      # @param _object [Object]
      def update_dbus_object(_dbus_object, _object)
        raise "Abstract method, derived classes must implement this"
      end

      # Whether the D-Bus object references to the given object
      #
      # @raise Must be defined by derived classes
      #
      # @param _dbus_object [DBus::BaseObject]
      # @param _object [Object]
      #
      # @return [Boolean]
      def dbus_object?(_dbus_object, _object)
        raise "Abstract method, derived classes must implement this"
      end

      # All exported D-Bus objects in the tree
      #
      # @return [Array<DBus::BaseObject>]
      def dbus_objects
        root = service.get_node(root_path, create: false)
        return [] unless root

        root.descendant_objects
      end

      # For each object in the given list a D-Bus object is exported if there is no D-Bus object for
      # it yet
      #
      # @param objects [Array<Object>]
      def try_add_objects(objects)
        objects.each do |object|
          next if find_dbus_object(object)

          dbus_object = create_dbus_object(object)
          service.export(dbus_object)
        end
      end

      # Updates the D-Bus objects that reference to an object included in the given list
      #
      # @param objects [Array<Object>]
      def try_update_objects(objects)
        objects.each do |object|
          dbus_object = find_dbus_object(object)
          next unless dbus_object

          update_dbus_object(dbus_object, object)
        end
      end

      # Unexports the D-Bus objects that reference to an object not included in the given list
      #
      # @param objects [Array<Object>]
      def try_delete_objects(objects)
        dbus_objects.each do |dbus_object|
          next if objects.any? { |o| dbus_object?(dbus_object, o) }

          service.unexport(dbus_object)
        end
      end
    end
  end
end
