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

require "dinstaller/installation_phase"

module DInstallerCli
  module Commands
    # Mixin that provides methods to ensure a specific installation phase while running code
    #
    # @note Requires a #manager_client method that returns an instance of
    #   {DInstaller::DBus::Clients::Manager}.
    module EnsureConfigPhase
      # Ensures the config phase is executed before calling the given block
      #
      # @param block [Proc]
      def ensure_config_phase(&block)
        manager_client.probe unless config_phase?
        block.call
      end

      # Whether the manager client is in config phase
      #
      # @return [Boolean]
      def config_phase?
        manager_client.current_installation_phase == DInstaller::InstallationPhase::CONFIG
      end
    end
  end
end
