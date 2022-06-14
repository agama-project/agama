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
require "dinstaller_cli/commands/config"
require "dinstaller_cli/commands/language"
require "dinstaller_cli/commands/software"
require "dinstaller_cli/commands/storage"
require "dinstaller_cli/commands/root_user"
require "dinstaller_cli/commands/user"
require "dinstaller_cli/clients/manager"

module DInstallerCli
  module Commands
    # Main command
    class Main < Thor
      def self.exit_on_failure?
        true
      end

      desc "install", "Perform the installation"
      def install
        answer = ask("Do you want to start the installation?", limited_to: ["y", "n"])
        return unless answer == "y"

        manager_client.commit
      rescue InstallConfigReader::Error
        say_error("error: invalid configuration")
      end

      desc "status", "Get installation status"
      def status
        status = case manager_client.status
        when 0
          "error"
        when 1
          "probing"
        when 2
          "probed"
        when 3
          "installing"
        when 4
          "installed"
        else
          "unknown"
        end

        say(status)
      end

      desc "language SUBCOMMAND", "Manage language configuration"
      subcommand "language", Language

      desc "software SUBCOMMAND", "Manage software configuration"
      subcommand "software", Software

      desc "storage SUBCOMMAND", "Manage storage configuration"
      subcommand "storage", Storage

      desc "rootuser SUBCOMMAND", "Manage root user configuration"
      subcommand "rootuser", RootUser

      desc "user SUBCOMMAND", "Manage first user configuration"
      subcommand "user", User

    private

      def manager_client
        @manager_client ||= Clients::Manager.new
      end
    end
  end
end
