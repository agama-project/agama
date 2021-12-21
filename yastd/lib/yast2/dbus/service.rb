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
require "yast2/dbus/installer"
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
      OBJECT_PATH = "/org/opensuse/YaST/Installer"

      def initialize(logger = nil)
        @logger = logger || Logger.new(STDOUT)
      end

      def run
        bus = ::DBus.system_bus
        service = bus.request_service(SERVICE_NAME)
        installer_obj = Yast2::DBus::Installer.new(build_installer, logger, OBJECT_PATH)
        service.export(installer_obj)
        dbus_loop = ::DBus::Main.new
        dbus_loop << bus
        logger.info "Listening on #{OBJECT_PATH}"
        dbus_loop.run
      end

    private

      attr_reader :logger

      def build_installer
        installer = Yast2::Installer.new(
          dbus_client: Yast2::DBus::InstallerClient.new,
          logger:      logger
        )
        installer.probe
        installer
      end
    end
  end
end
