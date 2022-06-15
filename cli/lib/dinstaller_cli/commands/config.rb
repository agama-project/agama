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
require "dinstaller_cli/install_config"
require "dinstaller_cli/install_config_reader"
require "dinstaller_cli/clients/language"
require "dinstaller_cli/clients/software"
require "dinstaller_cli/clients/storage"
require "dinstaller/dbus/clients/users"

module DInstallerCli
  module Commands
    # Subcommand to configure the installation
    class Config < Thor
      desc "load <config>", "Load a config file and apply the configuration"
      def load(config_source)
        config = InstallConfigReader.new(config_source).read
        configure_installation(config)
      rescue DInstallerCli::InstallConfigReader::Error
        say_error("error: invalid configuration")
      end

      desc "dump", "Dump the current installation config to stdout"
      def dump
        say(current_config.dump)
      end

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

      # Generates an installation config with the current configured values
      #
      # @return [InstallConfig]
      def current_config
        InstallConfig.new.tap do |config|
          product = software_client.selected_product

          config.product = product unless product.empty?
          config.languages = language_client.selected_languages
          config.disks = storage_client.candidate_devices

          config.user = current_user_config
          config.root = current_root_config
        end
      end

      # Generates a user config with the current configured values
      #
      # @note The password is not recovered
      #
      # @return [InstallConfig::User]
      def current_user_config
        fullname, name, autologin = users_client.first_user

        InstallConfig::User.new.tap do |user|
          user.name = name unless name.empty?
          user.fullname = fullname unless fullname.empty?
          user.autologin = autologin
        end
      end

      # Generates a root config with the current configured values
      #
      # @note The password is not recovered
      #
      # @return [InstallConfig::Root]
      def current_root_config
        ssh_key = users_client.root_ssh_key

        InstallConfig::Root.new.tap do |root|
          root.ssh_key = ssh_key unless ssh_key.empty?
        end
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
        @users_client ||= DInstaller::DBus::Clients::Users.new
      end
    end
  end
end
