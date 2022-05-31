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
    # D-Bus client for users configuration
    class Users
      def initialize
        @dbus_object = service.object("/org/opensuse/DInstaller/Users1")
        @dbus_object.introspect
      end

      # Configuration of the first user to create during the installation
      #
      # @return [Array<String, String, Boolean>] full name, name and autologin
      def first_user
        dbus_object["org.opensuse.DInstaller.Users1"]["FirstUser"][0..2]
      end

      # Configures the first user to create during the installation
      #
      # @param name [String]
      # @param fullname [String, nil]
      # @param password [String, nil]
      # @param autologin [Boolean]
      def create_first_user(name, fullname: nil, password: nil, autologin: false)
        dbus_object.SetFirstUser(fullname.to_s, name, password.to_s, !!autologin, {})
      end

      # Removes the configuration of the first user
      def remove_first_user
        dbus_object.RemoveFirstUser
      end

      # SSH key for root
      #
      # @return [String] empty if no SSH key set
      def root_ssh_key
        dbus_object["org.opensuse.DInstaller.Users1"]["RootSSHKey"]
      end

      # Sets the SSH key for root
      #
      # @param value [String]
      def root_ssh_key=(value)
        dbus_object.SetRootSSHKey(value)
      end

      # Whether the root password is set
      #
      # @return [Boolean]
      def root_password?
        dbus_object["org.opensuse.DInstaller.Users1"]["RootPasswordSet"]
      end

      # Sets the root password
      #
      # @param value [String]
      def root_password=(value)
        dbus_object.SetRootPassword(value, false)
      end

      # Removes the SSH key and password for root
      def remove_root_info
        dbus_object.RemoveRootPassword
        dbus_object.SetRootSSHKey("")
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
