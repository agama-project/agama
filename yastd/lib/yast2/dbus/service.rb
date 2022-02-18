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
require "yast2/dbus/installer"
require "yast2/dbus/language"
require "yast2/dbus/software"
require "yast2/installer"

module Yast2
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
      SERVICE_NAME = "org.opensuse.YaST"

      # @return [String] D-Bus object path
      OBJECT_PATH = "/org/opensuse/YaST/Installer1"

      attr_reader :bus

      def initialize(logger = nil)
        @logger = logger || Logger.new(STDOUT)
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
        @dbus_objects ||= [installer_dbus, language_dbus, software_dbus]
      end

      def installer_dbus
        @installer_dbus ||= Yast2::DBus::Installer.new(yast_installer, logger)
      end

      def language_bus
        @language_dbus ||= Yast2::DBus::Language.new(yast_installer, logger)
      end

      def software_bus
        @software_dbus ||= Yast2::DBus::Software.new(yast_installer, logger)
      end

      def installer
        @yast_installer ||= Yast2::Installer.new(logger: logger).tap do |installer|
          # FIXME: do not probe by default
          installer.probe
          installer.dbus_objects = dbus_objects
        end
      end
    end
  end
end
