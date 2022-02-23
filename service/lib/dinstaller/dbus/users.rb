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
require "dinstaller/users"

module DInstaller
  module DBus
    # YaST D-Bus object (/org/opensuse/YaST/Installer1)
    #
    # @see https://rubygems.org/gems/ruby-dbus
    class Users < ::DBus::Object
      PATH = "/org/opensuse/DInstaller/Users1".freeze
      private_constant :PATH

      LANGUAGE_INTERFACE = "org.opensuse.DInstaller.Users1".freeze
      private_constant :USERS_INTERFACE

      def initialize(logger)
        @logger = logger
        @root_password_set = false

        super(PATH)
      end

      dbus_interface USERS_INTERFACE do
        dbus_reader :root_password_set, "b"

        dbus_reader :root_ssh_key, "s", dbus_name: "RootSSHKey"

        dbus_reader :first_user, "(ssba{sv})"

        dbus_method :SetRootPassword, "in Value:s, in Encrypted:b" do |value, encrypted|
          logger.info "Setting Root Password"
          backend.assign_root_password(value, encrypted)

          self[DBus::PROPERTY_INTERFACE].PropertiesChanged(USERS_INTERFACE, {"RootPasswordSet" => !value.empty?}, [])
        end

        dbus_method :SetRootSSHKey, "in Value:s" do |value|
          logger.info "Setting Root ssh key"
          backend.root_ssh_key=(value)

          self[DBus::PROPERTY_INTERFACE].PropertiesChanged(USERS_INTERFACE, {"RootSSHKey" => value}, [])
        end

        FUSER_SIG = "in FullName:s, in UserName:s, in Password:s, in AutoLogin:b, in data:a{sv}"
        dbus_method :SetFirstUser, FUSER_SIG do |full_name, user_name, password, auto_login, data|
          logger.info "Setting first user #{full_name}"
          backend.assign_first_user(full_name, user_name, password, auto_login, data)

          self[DBus::PROPERTY_INTERFACE].PropertiesChanged(USERS_INTERFACE, {"FirstUser" => first_user}, [])
        end


      end

      def root_ssh_key
        backend.root_ssh_key
      end

      def first_user
        backend.first_user
      end

      def root_password_set
        backend.root_password?
      end

    private

      attr_reader :logger

      def backend
        @backend = ::DInstaller::Users.instance.tap { |i| i.logger = @logger }
      end

    end
  end
end
