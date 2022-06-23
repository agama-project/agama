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
require "dinstaller/users"

module DInstaller
  module DBus
    # YaST D-Bus object (/org/opensuse/DInstaller/Users1)
    #
    # @see https://rubygems.org/gems/ruby-dbus
    class Users < ::DBus::Object
      PATH = "/org/opensuse/DInstaller/Users1"
      private_constant :PATH

      USERS_INTERFACE = "org.opensuse.DInstaller.Users1"
      private_constant :USERS_INTERFACE
      FUSER_SIG = "in FullName:s, in UserName:s, in Password:s, in AutoLogin:b, in data:a{sv}"
      private_constant :FUSER_SIG

      def initialize(backend, logger)
        @backend = backend
        @logger = logger

        register_status_callback

        super(PATH)
      end

      # rubocop:disable Metrics/BlockLength
      dbus_interface USERS_INTERFACE do
        dbus_reader :root_password_set, "b"

        dbus_reader :root_ssh_key, "s", dbus_name: "RootSSHKey"

        dbus_reader :first_user, "(ssba{sv})"

        dbus_method :SetRootPassword,
          "in Value:s, in Encrypted:b, out result:u" do |value, encrypted|
          logger.info "Setting Root Password"
          backend.assign_root_password(value, encrypted)

          dbus_properties_changed(USERS_INTERFACE, { "RootPasswordSet" => !value.empty? }, [])
          0
        end

        dbus_method :RemoveRootPassword, "out result:u" do
          logger.info "Clearing the root password"
          backend.remove_root_password

          dbus_properties_changed(USERS_INTERFACE, { "RootPasswordSet" => backend.root_password? },
            [])
          0
        end

        dbus_method :SetRootSSHKey, "in Value:s, out result:u" do |value|
          logger.info "Setting Root ssh key"
          backend.root_ssh_key = (value)

          dbus_properties_changed(USERS_INTERFACE, { "RootSSHKey" => value }, [])
          0
        end

        dbus_method :SetFirstUser,
          FUSER_SIG + ", out result:u" do |full_name, user_name, password, auto_login, data|
          logger.info "Setting first user #{full_name}"
          backend.assign_first_user(full_name, user_name, password, auto_login, data)

          dbus_properties_changed(USERS_INTERFACE, { "FirstUser" => first_user }, [])
          0
        end

        dbus_method :RemoveFirstUser, "out result:u" do
          logger.info "Removing the first user"
          backend.remove_first_user

          dbus_properties_changed(USERS_INTERFACE, { "FirstUser" => {} }, [])
          0
        end

        dbus_method :Write, "out result:u" do
          logger.info "Writting users"

          backend.write(nil) # TODO: progress?
          0
        end

        # Current status
        #
        # TODO: these values come from the id of statuses, see {DInstaller::Status::Base}. This
        #   D-Bus class should explicitly convert statuses to integer instead of relying on the id
        #   value, which could change.
        #
        # Possible values:
        #   0 : error
        #   1 : probing
        #   2 : probed
        #   3 : installing
        #   4 : installed
        dbus_reader :status, "u"
      end
      # rubocop:enable Metrics/BlockLength

      def root_ssh_key
        backend.root_ssh_key
      end

      def first_user
        backend.first_user
      end

      def root_password_set
        backend.root_password?
      end

      # Id of the current status
      #
      # @return [Integer]
      def status
        backend.status_manager.status.id
      end

    private

      attr_reader :logger

      attr_reader :backend

      # Registers callback to be called when the status changes
      #
      # The callback will emit a signal
      def register_status_callback
        backend.status_manager.on_change do
          PropertiesChanged(USERS_INTERFACE, { "Status" => status }, [])
        end
      end
    end
  end
end
