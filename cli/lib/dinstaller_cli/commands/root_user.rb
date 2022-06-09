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
require "dinstaller_cli/clients/users"

module DInstallerCli
  module Commands
    # Subcommand to manage root user settings
    class RootUser < Thor
      desc "ssh_key [<key>]", "Set the SSH key for root"
      long_desc "Use without arguments to see the current SSH key value."
      def ssh_key(key = nil)
        client.root_ssh_key = key if key
        say(client.root_ssh_key)
      end

      desc "password [<plain password>]", "Set the root password"
      def password(password = nil)
        client.root_password = password if password
        say("<secret>") if client.root_password?
      end

      desc "clear", "Clear root configuration"
      def clear
        client.remove_root_info
      end

    private

      def client
        @client ||= Clients::Users.new
      end
    end
  end
end
