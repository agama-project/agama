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

require "agama/dbus/service_status"

module Agama
  # Allows to record the status of services and to register callbacks to be called when a service
  # status changes its value
  class ServiceStatusRecorder
    def initialize
      @statuses = {}
      @on_service_status_change_callbacks = []
    end

    # Saves the status of the given service and runs the callbacks if the status has changed
    #
    # @see ServiceStatus
    #
    # @param service_name [String]
    # @param status [String]
    def save(service_name, status)
      return if @statuses[service_name] == status

      @statuses[service_name] = status
      @on_service_status_change_callbacks.each(&:call)
    end

    # Name of services with busy status
    #
    # @return [Array<String>]
    def busy_services
      @statuses.select { |_service, status| status == DBus::ServiceStatus::BUSY }.keys
    end

    # Registers callbacks to be called when saving a new status
    #
    # @param block [Proc]
    def on_service_status_change(&block)
      @on_service_status_change_callbacks << block
    end
  end
end
