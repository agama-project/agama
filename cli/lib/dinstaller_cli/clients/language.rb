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
    # D-Bus client for language configuration
    class Language
      def initialize
        @dbus_object = service.object("/org/opensuse/DInstaller/Language1")
        @dbus_object.introspect
      end

      # Available languages for the installation
      #
      # @return [Array<Array<String, String>>] id and name of each language
      def available_languages
        dbus_object["org.opensuse.DInstaller.Language1"]["AvailableLanguages"].map { |l| l[0..1] }
      end

      # Languages selected to install
      #
      # @return [Array<String>] ids of the languages
      def selected_languages
        dbus_object["org.opensuse.DInstaller.Language1"]["MarkedForInstall"]
      end

      # Selects the languages to install
      #
      # @param ids [Array<String>]
      def select_languages(ids)
        dbus_object.ToInstall(ids)
      end

    private

      # @return [::DBus::Object]
      attr_reader :dbus_object

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
