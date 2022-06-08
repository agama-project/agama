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
require "dinstaller_cli/clients/storage"

module DInstallerCli
  module Commands
    # Subcommand to manage storage settings
    class Storage < Thor
      desc "available_devices", "List available devices for the installation"
      def available_devices
        puts client.available_devices
      end

      desc "selected_devices [<device>...]", "Select devices for the installation"
      long_desc "Use without arguments to see the currently selected devices."
      def selected_devices(*devices)
        client.calculate(devices) if devices.any?
        puts client.candidate_devices
      end

      desc "actions", "List the storage actions to perform"
      def actions
        puts client.actions
      end

    private

      def client
        @client ||= Clients::Storage.new
      end
    end
  end
end
