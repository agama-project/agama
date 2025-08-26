# frozen_string_literal: true

# Copyright (c) [2022-2025] SUSE LLC
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
require "agama/dbus/service_status"
require "agama/dbus/storage/iscsi"
require "agama/dbus/storage/manager"
require "agama/storage"
require "y2storage/inhibitors"

module Agama
  module DBus
    # D-Bus service (org.opensuse.Agama.Storage1)
    #
    # It connects to the system D-Bus and answers requests on objects below
    # `/org/opensuse/Agama/Storage1`.
    class StorageService
      SERVICE_NAME = "org.opensuse.Agama.Storage1"
      private_constant :SERVICE_NAME

      # @param config [Config] Configuration object
      # @param logger [Logger]
      def initialize(config, logger = nil)
        @config = config
        @logger = logger || Logger.new($stdout)
      end

      # D-Bus connection
      #
      # @return [::DBus::Connection]
      def bus
        Bus.current
      end

      # Starts storage service.
      def start
        # Inhibits various storage subsystem (udisk, systemd mounts, raid auto-assembly) that
        # interfere with the operation of yast-storage-ng and libstorage-ng.
        Y2Storage::Inhibitors.new.inhibit
        export
      end

      # Exports the storage proposal object through the D-Bus service
      def export
        dbus_objects.each { |o| service.export(o) }
        paths = dbus_objects.map(&:path).join(", ")
        logger.info "Exported #{paths} objects"
      end

      # Actions before stopping the service.
      def tear_down
        Y2Storage::Inhibitors.new.uninhibit
      end

      # Call this from some main loop to dispatch the D-Bus messages
      def dispatch
        bus.dispatch_message_queue
      end

    private

      # @return [Config]
      attr_reader :config

      # @return [Logger]
      attr_reader :logger

      # @return [::DBus::ObjectServer]
      def service
        @service ||= bus.request_service(SERVICE_NAME)
      end

      # @return [Array<::DBus::Object>]
      def dbus_objects
        @dbus_objects ||= [manager_object, iscsi_object]
      end

      # @return [Agama::DBus::Storage::Manager]
      def manager_object
        @manager_object ||= Agama::DBus::Storage::Manager.new(
          manager,
          service_status: service_status,
          logger:         logger
        )
      end

      # @return [Agama::DBus::Storage::ISCSI]
      def iscsi_object
        # Uses the same service status as the manager D-Bus object.
        @iscsi_object ||= Agama::DBus::Storage::ISCSI.new(
          manager.iscsi,
          service_status: service_status,
          logger:         logger
        )
      end

      # @return [Agama::Storage::Manager]
      def manager
        @manager ||= Agama::Storage::Manager.new(config, logger: logger)
      end

      # @return [Agama::DBus::ServiceStatus]
      def service_status
        @service_status ||= Agama::DBus::ServiceStatus.new
      end
    end
  end
end
