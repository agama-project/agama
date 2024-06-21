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

require "yast"
require "y2users"
require "y2users/linux" # FIXME: linux is not in y2users file
require "yast2/execute"
require "agama/helpers"
require "agama/issue"
require "agama/with_issues"

module Agama
  # Backend class using YaST code.
  #
  # {Agama::DBus::Users} wraps it with a D-Bus interface and
  class Users
    include Helpers
    include WithIssues
    include Yast::I18n

    def initialize(logger)
      textdomain "agama"
      @logger = logger
      update_issues
    end

    def root_ssh_key
      root_user.authorized_keys.first || ""
    end

    def root_ssh_key=(value)
      root_user.authorized_keys = [value] # just one supported for now
      update_issues
    end

    # NOTE: the root user is created if it does not exist
    def root_password?
      !!root_user.password_content
    end

    def root_ssh_key?
      !root_ssh_key.empty?
    end

    def assign_root_password(value, encrypted)
      pwd = if encrypted
        Y2Users::Password.create_encrypted(value)
      else
        Y2Users::Password.create_plain(value)
      end

      logger.info "Updating the user password"
      root_user.password = value.empty? ? nil : pwd
      update_issues
    end

    # Whether the given user is configured for autologin
    #
    # @param [Y2Users::User] user
    # @return [Boolean]
    def autologin?(user)
      config.login.autologin_user == user
    end

    # First created user
    #
    # @return [Y2Users::User, nil]
    def first_user
      config.users.reject(&:root?).first
    end

    # Clears the root password
    def remove_root_password
      root_user.password = nil
      update_issues
    end

    # It adds the user with the given parameters to the login config only if there are no error
    # issues detected like no user_name or no password given.
    #
    # @param full_name [String]
    # @param user_name [String]
    # @param password [String]
    # @param auto_login [Boolean]
    # @param _data [Hash]
    # @return [Array] the list of fatal issues found
    def assign_first_user(full_name, user_name, password, auto_login, _data)
      remove_first_user

      user = Y2Users::User.new(user_name)
      user.gecos = [full_name]
      user.password = Y2Users::Password.create_plain(password)
      fatal_issues = user.issues.map.select(&:error?)
      return fatal_issues.map(&:message) unless fatal_issues.empty?

      config.attach(user)
      config.login ||= Y2Users::LoginConfig.new
      config.login.autologin_user = auto_login ? user : nil
      update_issues
      []
    end

    # Removes the first user
    def remove_first_user
      old_users = config.users.reject(&:root?)
      config.detach(old_users) unless old_users.empty?
      update_issues
    end

    def write
      without_run_mount do
        on_target do
          system_config = Y2Users::ConfigManager.instance.system(force_read: true)
          target_config = system_config.copy
          Y2Users::ConfigMerger.new(target_config, config).merge

          writer = Y2Users::Linux::Writer.new(target_config, system_config)
          issues = writer.write
          logger.error(issues.inspect) unless issues.empty?
        end
      end
    end

  private

    attr_reader :logger

    # Recalculates the list of issues
    def update_issues
      new_issues = []

      unless root_password? || root_ssh_key? || first_user?
        new_issues << Issue.new(
          _("Defining a user, setting the root password or a SSH public key is required"),
          source:   Issue::Source::CONFIG,
          severity: Issue::Severity::ERROR
        )
      end

      self.issues = new_issues
    end

    # Determines whether a first user is defined or not
    #
    # @return [Boolean]
    def first_user?
      config.users.reject(&:root?).any?
    end

    def without_run_mount(&block)
      Yast::Execute.locally!("/usr/bin/umount", "/mnt/run")
      block.call
    ensure
      Yast::Execute.locally!("/usr/bin/mount", "-o", "bind", "/run", "/mnt/run")
    end

    def config
      return @config if @config

      @config = Y2Users::ConfigManager.instance.target
      if !@config
        @config = Y2Users::Config.new
        Y2Users::ConfigManager.instance.target = @config
      end

      @config
    end

    def root_user
      return @root_user if @root_user

      @root_user = config.users.root
      return @root_user if @root_user

      @root_user = Y2Users::User.create_root
      config.attach(@root_user)
      @root_user
    end
  end
end
