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
require "dinstaller/manager"
require "dinstaller/cockpit_manager"
require "dinstaller/dbus/manager"
require "dinstaller/dbus/network"
require "dinstaller/dbus/storage/proposal"

module DInstaller
  module DBus
    # D-Bus service (org.opensuse.DInstaller)
    #
    # It connects to the system D-Bus and answers requests on objects below
    # `/org/opensuse/DInstaller`.
    class ManagerService
      # Service name
      #
      # @return [String]
      SERVICE_NAME = "org.opensuse.DInstaller"
      private_constant :SERVICE_NAME

      # System D-Bus
      #
      # @return [::DBus::Connection]
      attr_reader :bus

      # Installation manager
      #
      # @return [DInstaller::Manager]
      attr_reader :manager

      # @param config [Config] Configuration
      # @param logger [Logger]
      def initialize(config, logger = nil)
        @config = config
        @manager = DInstaller::Manager.new(config, logger)
        @logger = logger || Logger.new($stdout)
        @bus = ::DBus::SystemBus.instance
      end

      # Initializes and exports the D-Bus API
      #
      # @note The service runs its startup phase
      def start
        setup_cockpit
        export
        manager.on_progress_change { dispatch } # make single thread more responsive
        manager.startup_phase
      end

      # Exports the installer object through the D-Bus service
      def export
        dbus_objects.each { |o| service.export(o) }

        paths = dbus_objects.map(&:path).join(", ")
        logger.info "Exported #{paths} objects"
      end

      # Call this from some main loop to dispatch the D-Bus messages
      def dispatch
        bus.dispatch_message_queue
      end

    private

      # @return [Logger]
      attr_reader :logger

      # @return [Config]
      attr_reader :config

      def setup_cockpit
        cockpit = CockpitManager.new(logger)
        cockpit.setup(config.data["web"])
      end

      # @return [::DBus::Service]
      def service
        @service ||= bus.request_service(SERVICE_NAME)
      end

      # @return [Array<::DBus::Object>]
      def dbus_objects
        @dbus_objects ||= [
          manager_dbus,
          network_dbus
        ]
      end

      # @return [Manager]
      def manager_dbus
        @manager_dbus ||= DInstaller::DBus::Manager.new(manager, logger)
      end

      # @return [Network]
      def network_dbus
        @network_dbus ||= DInstaller::DBus::Network.new(manager.network, logger)
      end
    end
  end
end
