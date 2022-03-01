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
require "dinstaller/dbus/manager"
require "dinstaller/dbus/language"
require "dinstaller/dbus/software"
require "dinstaller/dbus/users"
require "dinstaller/manager"

module DInstaller
  module DBus
    # YaST D-Bus service (org.opensuse.YaST)
    #
    # It connects to the system D-Bus and answers requests on `/org/opensuse/YaST/Installer`.
    #
    # @example Running the server
    #   Yast2::DBus::Service.new.run
    #
    # @see Yast2::DBus::Installer
    class Service
      # @return [String] service name
      SERVICE_NAME = "org.opensuse.DInstaller"

      # @return [String] D-Bus object path
      attr_reader :bus

      def initialize(logger = nil)
        @logger = logger || Logger.new($stdout)
        @bus = ::DBus::SystemBus.instance
      end

      # Exports the installer object through the D-Bus service
      def export
        dbus_objects.each { |o| service.export(o) }

        paths = dbus_objects.map(&:path).join(", ")
        logger.info "Exported #{paths} objects"
      end

      def dispatch
        bus.dispatch_message_queue
      end

    private

      attr_reader :logger

      def service
        @service ||= bus.request_service(SERVICE_NAME)
      end

      def dbus_objects
        @dbus_objects ||= [manager_bus, language_dbus, software_dbus, users_dbus]
      end

      def manager_bus
        @manager_bus ||= DInstaller::DBus::Manager.new(@logger)
      end

      def language_dbus
        @language_dbus ||= DInstaller::DBus::Language.new(installer, @logger)
      end

      def software_dbus
        @software_dbus ||= DInstaller::DBus::Software.new(installer, @logger)
      end

      def users_dbus
        @users_dbus ||= DInstaller::DBus::Users.new(@logger)
      end

      def installer
        # TODO: this god object should not be needed anymore when all dbus API is adapted
        # just that probe should  be kept to get installer probed ASAP
        @installer ||= DInstaller::Manager.instance.tap(&:probe)
      end
    end
  end
end
