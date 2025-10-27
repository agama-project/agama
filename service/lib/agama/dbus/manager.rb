# frozen_string_literal: true

# Copyright (c) [2021-2025] SUSE LLC
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
require "agama/autoyast/converter"
require "agama/dbus/base_object"
require "agama/dbus/interfaces/locale"
require "agama/dbus/interfaces/progress"
require "agama/dbus/interfaces/service_status"
require "agama/dbus/with_progress"
require "agama/dbus/with_service_status"
require "agama/manager"

module Agama
  module DBus
    # D-Bus object to manage the installation process
    class Manager < BaseObject
      include WithProgress
      include WithServiceStatus
      include Interfaces::Progress
      include Interfaces::ServiceStatus
      include Interfaces::Locale

      PATH = "/org/opensuse/Agama/Manager1"
      private_constant :PATH

      # Constructor
      #
      # @param backend [Agama::Manager]
      # @param logger [Logger]
      def initialize(backend, logger)
        super(PATH, logger: logger)
        @backend = backend
        register_callbacks
        register_progress_callbacks
        register_service_status_callbacks
      end

      MANAGER_INTERFACE = "org.opensuse.Agama.Manager1"
      private_constant :MANAGER_INTERFACE

      STARTUP_PHASE = 0
      CONFIG_PHASE = 1
      INSTALL_PHASE = 2
      FINISH_PHASE = 3

      dbus_interface MANAGER_INTERFACE do
        dbus_method(:Probe, "in data:a{sv}") { |_| config_phase }
        dbus_method(:Reprobe, "in data:a{sv}") { |_| config_phase(reprobe: true) }
        dbus_method(:Commit, "") { install_phase }
        dbus_method(:CanInstall, "out result:b") { can_install? }
        dbus_method(:CollectLogs, "out tarball_filesystem_path:s") { collect_logs }
        dbus_method(:Finish, "in method:s, out result:b") { |m| finish_phase(m) }
        dbus_reader :installation_phases, "aa{sv}"
        dbus_reader :current_installation_phase, "u"
        dbus_reader :iguana_backend, "b"
        dbus_reader :busy_services, "as"
      end

      # Runs the config phase
      #
      # @param reprobe [Boolean] Whether a reprobe should be done instead of a probe.
      def config_phase(reprobe: false)
        safe_run do
          busy_while { backend.config_phase(reprobe: reprobe) }
        end
      end

      # Runs the install phase
      def install_phase
        raise ::DBus::Error, "Installation settings are invalid" unless backend.valid?

        safe_run do
          busy_while { backend.install_phase }
        end
      end

      # Determines whether the installation can start
      #
      # @return [Boolean]
      def can_install?
        backend.valid?
      end

      # Collects the YaST logs
      def collect_logs
        backend.collect_logs
      end

      # Last action for the installer
      #
      # @param method [String]
      # @return [Boolean]
      def finish_phase(method)
        backend.finish_installation(method)
      end

      # Description of all possible installation phase values
      #
      # @return [Array<Hash>]
      def installation_phases
        [
          { "id" => STARTUP_PHASE, "label" => "startup" },
          { "id" => CONFIG_PHASE,  "label" => "config" },
          { "id" => INSTALL_PHASE, "label" => "install" },
          { "id" => FINISH_PHASE, "label"  => "finish" }
        ]
      end

      # Current value of the installation phase
      #
      # @return [Integer]
      def current_installation_phase
        return STARTUP_PHASE if backend.installation_phase.startup?
        return CONFIG_PHASE if backend.installation_phase.config?
        return INSTALL_PHASE if backend.installation_phase.install?
        return FINISH_PHASE if backend.installation_phase.finish?
      end

      # States whether installation runs on iguana
      def iguana_backend
        backend.iguana?
      end

      # Name of the services that are currently busy
      #
      # @return [Array<String>]
      def busy_services
        backend.busy_services
      end

      # Redefines #service_status to use the one from the backend
      #
      # @return [DBus::ServiceStatus]
      def service_status
        backend.service_status
      end

      def locale=(locale)
        safe_run do
          busy_while { backend.locale = locale }
        end
      end

    private

      # @return [Agama::Manager]
      attr_reader :backend

      # Executes the given block only if the service is idle
      #
      # @note The service still dispatches messages while waiting for a D-Bus answer.
      #
      # @param block [Proc]
      def safe_run(&block)
        raise busy_error if service_status.busy?

        block.call
      end

      def busy_error
        ::DBus.error("org.opensuse.Agama1.Error.Busy")
      end

      # Registers callback to be called
      def register_callbacks
        backend.installation_phase.on_change do
          dbus_properties_changed(MANAGER_INTERFACE,
            { "CurrentInstallationPhase" => current_installation_phase }, [])
        end

        backend.on_services_status_change do
          dbus_properties_changed(MANAGER_INTERFACE, { "BusyServices" => busy_services }, [])
        end
      end
    end
  end
end
