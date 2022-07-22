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
require "dinstaller/dbus/service_status"
require "dinstaller/dbus/interfaces/service_status"

module DInstaller
  module DBus
    module Clients
      # Mixin for clients of services that define the ServiceStatus D-Bus interface
      #
      # Provides methods to interact with the API of the ServiceStatus interface.
      #
      # @note This mixin is expected to be included in a class inherited from {Clients::Base} and
      #   it requires a #dbus_object method that returns a {::DBus::Object} implementing the
      #   ServiceStatus interface.
      module WithServiceStatus
        # Current value of the service status
        #
        # @see Interfaces::ServiceStatus
        #
        # @return [ServiceStatus::IDLE, ServiceStatus::BUSY]
        def service_status
          dbus_status = dbus_object[Interfaces::ServiceStatus::SERVICE_STATUS_INTERFACE]["Current"]
          to_service_status(dbus_status)
        end

        # Registers a callback to run when the current status property changes
        #
        # @param block [Proc]
        # @yieldparam service_status [ServiceStatus::IDLE, ServiceStatus::BUSY]
        def on_service_status_change(&block)
          on_properties_change(dbus_object) do |interface, changes, _|
            if interface == Interfaces::ServiceStatus::SERVICE_STATUS_INTERFACE
              service_status = to_service_status(changes["Current"])
              block.call(service_status)
            end
          end
        end

        # Converts the D-Bus status value to the equivalent service status value
        #
        # @param dbus_status [Integer]
        # @return [ServiceStatus::IDLE, ServiceStatus::BUSY]
        def to_service_status(dbus_status)
          case dbus_status
          when Interfaces::ServiceStatus::SERVICE_STATUS_IDLE
            ServiceStatus::IDLE
          when Interfaces::ServiceStatus::SERVICE_STATUS_BUSY
            ServiceStatus::BUSY
          end
        end
      end
    end
  end
end
