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
require "dinstaller_cli/install_config_reader"
require "dinstaller_cli/commands/language"
require "dinstaller_cli/commands/software"
require "dinstaller_cli/commands/storage"
require "dinstaller_cli/commands/root_user"
require "dinstaller_cli/commands/user"
require "dinstaller_cli/clients"

module DInstallerCli
  module Commands
    # Main command
    class Main < Thor
      def self.exit_on_failure?
        true
      end

      desc "install [<config>]", "Perform the installation"
      def install(config_source = nil)
        answer = ask("Do you want to start the installation?", limited_to: ["y", "n"])
        return unless answer == "y"

        if config_source
          config = InstallConfigReader.new(config_source).read
          configure_installation(config)
        end

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

        puts status
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

      # Configures the installation according to the given config
      #
      # Performs D-Bus calls to configure the proper services.
      #
      # @param config [InstallConfig]
      def configure_installation(config)
        software_client.select_product(config.product) if config.product
        language_client.select_languages(config.languages) if config.languages.any?
        storage_client.calculate(config.disks) if config.disks.any?

        configure_user(config.user) if config.user
        configure_root(config.root) if config.root
      end

      # Configures the user
      #
      # Performs D-Bus calls to configure the users service.
      #
      # @param user_config [InstallConfig::User]
      def configure_user(user_config)
        user_name = user_config.name || ""

        return if user_name.empty?

        users_client.create_first_user(user_config.name,
          fullname:  user_config.fullname,
          password:  user_config.password,
          autologin: user_config.autologin)
      end

      # Configures the root user
      #
      # Performs D-Bus calls to configure the users service.
      #
      # @param root_config [InstallConfig::Root]
      def configure_root(root_config)
        users_client.root_password = root_config.password if root_config.password
        users_client.root_ssh_key = root_config.ssh_key if root_config.ssh_key
      end

      def manager_client
        @manager_client ||= Clients::Manager.new
      end

      def language_client
        @language_client ||= Clients::Language.new
      end

      def software_client
        @software_client ||= Clients::Software.new
      end

      def storage_client
        @storage_client ||= Clients::Storage.new
      end

      def users_client
        @users_client ||= Clients::Users.new
      end
    end
  end
end
