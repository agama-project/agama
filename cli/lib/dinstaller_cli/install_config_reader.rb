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

require "yaml"
require "dinstaller_cli/install_config"

module DInstallerCli
  # Class for generating the config of the installation from a YAML file
  #
  # The YAML file has the following structure:
  #
  # languages:
  #   - <language-id>
  #   - <language-id>
  #
  # product: <product-id>
  #
  # disks:
  #   - <device-name>
  #   - <device-name>
  #
  # user:
  #   name:      <name>
  #   fullname:  <fullname>
  #   password:  <password>
  #   autologin: <autologin>
  #
  # root:
  #   password: <password>
  #   ssh_key:  <key>
  #
  # @example
  #   config = InstallConfigReader.new("example.yaml").read
  #   config.languages  #=> ["en_US", "es_ES"]
  #   config.disks      #=> ["/dev/vda"]
  #   config.user       #=> #<InstallConfig::User>
  #   config.user.name  #=> "john"
  class InstallConfigReader
    # Error reading or loading the config file
    class Error < RuntimeError; end

    # Constructor
    #
    # @param source [String] path of the config file
    def initialize(source)
      @source = source
    end

    # Reads the config file and generates an installation config
    #
    # @raise [Error] see {#load_content}
    #
    # @return [InstallConfig]
    def read
      content = load_content
      config_from(content)
    end

  private

    # Path to the config file
    #
    # @return [String]
    attr_reader :source

    # Creates an install config from the content of the YAML config file
    #
    # @param content [Hash] content of the config file
    # @return [InstallConfig]
    def config_from(content)
      InstallConfig.new.tap do |config|
        languages = content["languages"]
        product = content["product"]
        disks = content["disks"]
        user = content["user"]
        root = content["root"]

        config.languages = languages if languages
        config.product = product if product
        config.disks = disks if disks
        config.user = user_config_from(user) if user
        config.root = root_config_from(root) if root
      end
    end

    # Generates a user config according to the user section of the YAML config file
    #
    # @param user_content [Hash] user section
    # @return [InstallConfig::User]
    def user_config_from(user_content)
      InstallConfig::User.new(
        name:      user_content["name"],
        fullname:  user_content["fullname"],
        password:  user_content["password"],
        autologin: user_content["autologin"]
      )
    end

    # Generates a root config according to the root section of the YAML config file
    #
    # @param root_content [Hash] root section
    # @return [InstallConfig::Root]
    def root_config_from(root_content)
      InstallConfig::Root.new(password: root_content["password"], ssh_key: root_content["ssh_key"])
    end

    # Loads the content of the YAML config file
    #
    # @raise [Error] if the file cannot be loaded
    def load_content
      YAML.load_file(source)
    rescue StandardError => e
      raise Error, e.message
    end
  end
end
