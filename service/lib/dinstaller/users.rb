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

require "yast"
require "y2users"
require "y2users/linux" # FIXME: linux is not in y2users file
require "yast2/execute"

module DInstaller
  # Backend class between dbus service and yast code
  class Users
    def initialize(logger)
      @logger = logger
    end

    def root_ssh_key
      root_user.authorized_keys.first || ""
    end

    def root_ssh_key=(value)
      root_user.authorized_keys = [value] # just one supported for now
    end

    def root_password?
      !!root_user.password_content
    end

    def assign_root_password(value, encrypted)
      pwd = if encrypted
        Y2Users::Password.create_encrypted(value)
      else
        Y2Users::Password.create_plain(value)
      end

      root_user.password = value.empty? ? nil : pwd
    end

    def first_user
      user = config.users.reject(&:root?).first

      return ["", "", false, {}] unless user

      # TODO: not sure if backend should return structure of dbus?
      [user.full_name, user.name, config.login.autologin_user == user, {}]
    end

    # Clears the root password
    def remove_root_password
      root_user.password = nil
    end

    def assign_first_user(full_name, user_name, password, auto_login, _data)
      remove_first_user

      user = Y2Users::User.new(user_name)
      user.gecos = [full_name]
      user.password = Y2Users::Password.create_plain(password)
      config.attach(user)
      config.login ||= Y2Users::LoginConfig.new
      config.login.autologin_user = auto_login ? user : nil
    end

    # Removes the first user
    def remove_first_user
      old_users = config.users.reject(&:root?)
      config.detach(old_users) unless old_users.empty?
    end

    def write(_progress)
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

    def without_run_mount(&block)
      Yast::Execute.locally!("/usr/bin/umount", "/mnt/run")
      block.call
    ensure
      Yast::Execute.locally!("/usr/bin/mount", "-o", "bind", "/run", "/mnt/run")
    end

    # Run a block in the target system
    # TODO: it is C&P from manager.rb. Maybe mixin as each process need to switch target?
    def on_target(&block)
      old_handle = Yast::WFM.SCRGetDefault
      handle = Yast::WFM.SCROpen("chroot=#{Yast::Installation.destdir}:scr", false)
      Yast::WFM.SCRSetDefault(handle)

      begin
        block.call
      rescue StandardError => e
        logger.error "Error while running on target tasks: #{e.inspect}"
      ensure
        Yast::WFM.SCRSetDefault(old_handle)
        Yast::WFM.SCRClose(handle)
      end
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
