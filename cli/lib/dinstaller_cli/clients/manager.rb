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

module DInstallerCli
  module Clients
    # D-Bus client for DInstaller service
    class Manager
      def initialize
        @dbus_object = service.object("/org/opensuse/DInstaller/Manager1")
        @dbus_object.introspect

        register_callbacks
      end

      # Starts the installation
      def commit
        dbus_object.Commit
      end

      # Current status of the installation
      #
      # @return [Integer]
      def status
        dbus_object["org.opensuse.DInstaller.Manager1"]["Status"]
      end

    private

      # @return [::DBus::Object]
      attr_reader :dbus_object

      def register_callbacks
        dbus_properties = dbus_object["org.freedesktop.DBus.Properties"]

        dbus_properties.on_signal("PropertiesChanged") do |_, properties, _|
          report_progress(properties["Progress"])
        end
      end

      def report_progress(progress)
        return if progress.nil?

        message, total, current, total_minor, = progress

        if total_minor == 0
          puts "(#{current + 1}/#{total + 1}) #{message}"
        else
          puts "\t#{message}"
        end
      end

      # @return [::DBus::Service]
      def service
        @service ||= bus.service("org.opensuse.DInstaller")
      end

      def bus
        @bus ||= DBus::SystemBus.instance
      end
    end
  end
end
