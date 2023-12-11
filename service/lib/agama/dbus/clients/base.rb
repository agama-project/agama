# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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
require "agama/dbus/bus"
require "abstract_method"

module Agama
  module DBus
    module Clients
      # Base class for D-Bus clients
      #
      # The clients should be singleton because the #on_properties_change method
      # will not work properly with several instances. Given a
      # ::DBus::BusConnection object, ruby-dbus does not allow to register more
      # than one callback for the same object.
      #
      # It causes the last instance to overwrite the callbacks from previous ones.
      #
      # @example Creating a new client
      #   require "singleton"
      #
      #   class Locale < Base
      #     include Singleton
      #
      #     # client methods
      #   end
      class Base
        # @!method service_name
        #   Name of the D-Bus service
        #   @return [String]
        abstract_method :service_name

        # Constructor
        #
        # @param logger [Logger, nil]
        def initialize(logger: nil)
          @logger = logger || Logger.new($stdout)
        end

        # D-Bus service
        #
        # @return [::DBus::ObjectServer]
        def service
          @service ||= bus.service(service_name)
        end

      private

        # @return [Logger]
        attr_reader :logger

        # Registers callback to be called when the properties of the given object changes
        #
        # @note Signal subscription is done only once. Otherwise, the latest subscription overrides
        #   the previous one.
        #
        # @param dbus_object [::DBus::Object]
        # @param block [Proc]
        def on_properties_change(dbus_object, &block)
          @on_properties_change_callbacks ||= {}
          @on_properties_change_callbacks[dbus_object.path] ||= []
          @on_properties_change_callbacks[dbus_object.path] << block

          return if @on_properties_change_callbacks[dbus_object.path].size > 1

          dbus_properties = dbus_object["org.freedesktop.DBus.Properties"]
          dbus_properties.on_signal("PropertiesChanged") do |interface, changes, invalid|
            callbacks = @on_properties_change_callbacks[dbus_object.path]
            callbacks.each { |c| c.call(interface, changes, invalid) }
          end
        end

        def bus
          @bus ||= Bus.current
        end
      end
    end
  end
end
