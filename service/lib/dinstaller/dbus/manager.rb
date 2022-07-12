# frozen_string_literal: true

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

require "dbus"
require "dinstaller/manager"
require "dinstaller/dbus/base_object"
require "dinstaller/dbus/with_service_status"
require "dinstaller/dbus/interfaces/progress"
require "dinstaller/dbus/interfaces/service_status"

module DInstaller
  module DBus
    # D-Bus object to manage the installation process
    class Manager < BaseObject
      include WithServiceStatus
      include Interfaces::Progress
      include Interfaces::ServiceStatus

      PATH = "/org/opensuse/DInstaller/Manager1"
      private_constant :PATH

      # Constructor
      #
      # @param backend [DInstaller::Manager]
      # @param logger [Logger]
      def initialize(backend, logger)
        super(PATH, logger: logger)
        @backend = backend
        register_callbacks
        register_progress_callbacks
        register_service_status_callbacks
      end

      MANAGER_INTERFACE = "org.opensuse.DInstaller.Manager1"
      private_constant :MANAGER_INTERFACE

      dbus_interface MANAGER_INTERFACE do
        dbus_method(:Probe, "") { config_phase }
        dbus_method(:Commit, "") { install_phase }
        dbus_reader :installation_phases, "aa{sv}"
        dbus_reader :current_installation_phase, "u"
        dbus_reader :busy_services, "as"
      end

      # Runs the config phase
      def config_phase
        busy_while { backend.config_phase }
      end

      # Runs the install phase
      def install_phase
        busy_while { backend.install_phase }
      end

      # Description of all possible installation phase values
      #
      # @return [Array<Hash>]
      def installation_phases
        [
          { "id" => 0, "label" => "startup" },
          { "id" => 1, "label" => "config" },
          { "id" => 2, "label" => "install" }
        ]
      end

      # Current value of the installation phase
      #
      # @return [Integer]
      def current_installation_phase
        return 0 if backend.installation_phase.startup?
        return 1 if backend.installation_phase.config?
        return 2 if backend.installation_phase.install?
      end

      # Name of the services that are currently busy
      #
      # @return [Array<String>]
      def busy_services
        backend.service_status_recorder.busy_services
      end

    private

      # @return [DInstaller::Manager]
      attr_reader :backend

      # Registers callback to be called
      def register_callbacks
        backend.installation_phase.on_change do
          dbus_properties_changed(MANAGER_INTERFACE,
            { "CurrentInstallationPhase" => current_installation_phase }, [])
        end

        backend.service_status_recorder.on_service_status_change do
          dbus_properties_changed(MANAGER_INTERFACE, { "BusyServices" => busy_services }, [])
        end
      end
    end
  end
end
