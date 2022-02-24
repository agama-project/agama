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

require "singleton"
require "yast"
require "y2users"

module DInstaller
  class Users
    include Singleton

    attr_writer :logger

    def logger
      @logger || Logger.new($STDERR)
    end

    def root_ssh_key
      root_user.authorized_keys.first || ""
    end

    def root_ssh_key=(value)
      root_user.authorized_keys = [value] # just one supported for now
    end

    def root_password?
      !!root_user.password&.value
    end

    def assign_root_password(value, encrypted)
      pwd = if encrypted
        Y2Users::Password.create_encrypted(value)
      else
        Y2Users::Password.create_plain(value)
      end

      root_user.password = pwd
    end

    def first_user
      user = config.users.reject(&:root?).first

      return ["", "", false, {}] unless user

      # TODO: not sure if backend should return structure of dbus?
      [user.full_name, user.name, config.login.autologin_user == user, {}]
    end

    def assign_first_user(full_name, user_name, password, auto_login)
      # at first remove previous first user
      config.users.reject(&:root?).map(&:id).each { |id| config.users.delete(id) }
      return if user_name.empty? # empty is used to remove first user

      user = Y2Users::User.new(user_name)
      user.gecos = [full_name]
      user.password = Y2Users::Password.create_plain(password)
      config.attach_element(user)
      config.login.autologin_user = auto_login ? user : nil
    end

  private

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
      @root_user ||= config.users.root || Y2Users::User.create_root
    end
  end
end
