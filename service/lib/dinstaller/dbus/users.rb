# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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
require "dinstaller/dbus/base_object"
require "dinstaller/dbus/with_service_status"
require "dinstaller/dbus/interfaces/service_status"
require "dinstaller/dbus/interfaces/validation"

module DInstaller
  module DBus
    # YaST D-Bus object (/org/opensuse/DInstaller/Users1)
    class Users < BaseObject
      include WithServiceStatus
      include Interfaces::ServiceStatus
      include Interfaces::Validation

      PATH = "/org/opensuse/DInstaller/Users1"
      private_constant :PATH

      # Constructor
      #
      # @param backend [DInstaller::Users]
      # @param logger [Logger]
      def initialize(backend, logger)
        super(PATH, logger: logger)
        @backend = backend
        register_service_status_callbacks
      end

      USERS_INTERFACE = "org.opensuse.DInstaller.Users1"
      private_constant :USERS_INTERFACE

      FUSER_SIG = "in FullName:s, in UserName:s, in Password:s, in AutoLogin:b, in data:a{sv}"
      private_constant :FUSER_SIG

      dbus_interface USERS_INTERFACE do
        dbus_reader :root_password_set, "b"

        dbus_reader :root_ssh_key, "s", dbus_name: "RootSSHKey"

        dbus_reader :first_user, "(sssba{sv})"

        dbus_method :SetRootPassword,
          "in Value:s, in Encrypted:b, out result:u" do |value, encrypted|
          logger.info "Setting Root Password"
          backend.assign_root_password(value, encrypted)

          dbus_properties_changed(USERS_INTERFACE, { "RootPasswordSet" => !value.empty? }, [])
          update_validation
          0
        end

        dbus_method :RemoveRootPassword, "out result:u" do
          logger.info "Clearing the root password"
          backend.remove_root_password

          dbus_properties_changed(USERS_INTERFACE, { "RootPasswordSet" => backend.root_password? },
            [])
          update_validation
          0
        end

        dbus_method :SetRootSSHKey, "in Value:s, out result:u" do |value|
          logger.info "Setting Root ssh key"
          backend.root_ssh_key = (value)

          dbus_properties_changed(USERS_INTERFACE, { "RootSSHKey" => value }, [])
          update_validation
          0
        end

        dbus_method :SetFirstUser,
          # It returns an Struct with the first field with the result of the operation as a boolean
          # and the second parameter as an array of issues found in case of failure
          FUSER_SIG + ", out result:(bas)" do |full_name, user_name, password, auto_login, data|
          logger.info "Setting first user #{full_name}"
          issues = backend.assign_first_user(full_name, user_name, password, auto_login, data)

          if issues.empty?
            dbus_properties_changed(USERS_INTERFACE, { "FirstUser" => first_user }, [])
            update_validation
          else
            logger.info "First user fatal issues detected: #{issues}"
          end

          [[issues.empty?, issues]]
        end

        dbus_method :RemoveFirstUser, "out result:u" do
          logger.info "Removing the first user"
          backend.remove_first_user

          dbus_properties_changed(USERS_INTERFACE, { "FirstUser" => first_user }, [])
          update_validation
          0
        end

        dbus_method :Write, "out result:u" do
          logger.info "Writting users"

          backend.write
          0
        end
      end

      def root_ssh_key
        backend.root_ssh_key
      end

      def first_user
        user = backend.first_user

        return ["", "", "", false, {}] unless user

        [
          user.full_name,
          user.name,
          user.password_content || "",
          backend.autologin?(user),
          {}
        ]
      end

      def root_password_set
        backend.root_password?
      end

    private

      # @return [DInstaller::Users]
      attr_reader :backend
    end
  end
end
