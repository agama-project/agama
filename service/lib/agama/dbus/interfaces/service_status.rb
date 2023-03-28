# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

module DInstaller
  module DBus
    module Interfaces
      # Mixin to define the ServiceStatus D-Bus interface
      #
      # @note This mixin is expected to be included in a class inherited from {::DBus::Object} and
      #   it requires a #service_status method that returns a {DInstaller::DBus::ServiceStatus}
      #   object.
      #
      # @example
      #   class Demo < ::DBus::Object
      #     include DInstaller::DBus::Interfaces::ServiceStatus
      #
      #     def initialize
      #       super("org.test.Demo")
      #       register_service_status_callbacks
      #     end
      #
      #     def service_status
      #       @service_status ||= DInstaller::DBus::ServiceStatus.new
      #   end
      module ServiceStatus
        SERVICE_STATUS_INTERFACE = "org.opensuse.DInstaller.ServiceStatus1"

        SERVICE_STATUS_IDLE = 0
        SERVICE_STATUS_BUSY = 1

        # Description of all possible service status values
        #
        # @return [Array<Hash>]
        def service_status_all
          [
            { "id" => SERVICE_STATUS_IDLE, "label" => "idle" },
            { "id" => SERVICE_STATUS_BUSY, "label" => "busy" }
          ]
        end

        # Current value of the service status
        #
        # @return [Integer]
        def service_status_current
          service_status.busy? ? SERVICE_STATUS_BUSY : SERVICE_STATUS_IDLE
        end

        # Registers callbacks to be called when the value of the service status changes
        #
        # @note This method is expected to be called in the constructor.
        def register_service_status_callbacks
          service_status.on_change do
            dbus_properties_changed(SERVICE_STATUS_INTERFACE,
              { "Current" => service_status_current }, [])
          end
        end

        def self.included(base)
          base.class_eval do
            dbus_interface SERVICE_STATUS_INTERFACE do
              dbus_reader :service_status_all, "aa{sv}", dbus_name: "All"
              dbus_reader :service_status_current, "u", dbus_name: "Current"
            end
          end
        end
      end
    end
  end
end
