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

require "thor"
require "dinstaller/dbus/clients/users"

module DInstallerCli
  module Commands
    # Subcommand to manage first user settings
    class User < Thor
      desc "set <name>", "Configure the user that will be created during the installation"
      option :fullname, banner: "<full-name>", desc: "Set the user's full name"
      option :password, banner: "<plain-password>", desc: "Set the user's password"
      option :autologin, type: :boolean, default: false,
        desc: "Enable/disable user autologin (disabled by default)"
      def set(name)
        result, issues = client.create_first_user(name,
          fullname:  options[:fullname],
          password:  options[:password],
          autologin: options[:autologin])
        say(issues.join("\n")) unless result
      end

      desc "show", "Show the user configuration"
      def show
        full_name, name, _, autologin = client.first_user

        return if name.empty?

        say("Full Name: #{full_name}\n" \
            "Name: #{name}\n" \
            "Autologin: #{autologin ? "yes" : "no"}\n" \
            "Password: <secret>")
      end

      desc "clear", "Clear the user configuration"
      def clear
        client.remove_first_user
      end

    private

      def client
        @client ||= DInstaller::DBus::Clients::Users.new
      end
    end
  end
end
