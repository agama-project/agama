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
require "dinstaller_cli/commands/ensure_config_phase"
require "dinstaller/dbus/clients/manager"
require "dinstaller/dbus/clients/software"

module DInstallerCli
  module Commands
    # Main command
    class Main < Thor
      include EnsureConfigPhase

      def self.exit_on_failure?
        true
      end

      desc "install", "Perform the installation"
      def install
        answer = ask("Do you want to start the installation?", limited_to: ["y", "n"])
        return unless answer == "y"

        register_callbacks
        ensure_config_phase { manager_client.commit }
      end

      desc "config SUBCOMMAND", "Manage configuration of the installation"
      subcommand "config", Config

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
        @manager_client ||= DInstaller::DBus::Clients::Manager.new
      end

      def software_client
        @software_client ||= DInstaller::DBus::Clients::Software.new
      end

      # Registers callbacks
      def register_callbacks
        # Callback to show the main progress
        manager_client.on_progress_change do |total_steps, current_step, message, finished|
          feedback = finished ? "Done" : "(#{current_step}/#{total_steps}) #{message}"
          say(feedback)
        end

        # Callback to show the software progress
        software_client.on_progress_change do |_, _, message, finished|
          say("--> #{message}") unless finished
        end
      end
    end
  end
end
