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

require "singleton"
require "forwardable"
require "yast"
require "y2network/proposal_settings"
require "dinstaller/dbus/clients/network_manager"
Yast.import "Lan"

module DInstaller
  module Network
    # Backend class to handle network configuration
    class Manager
      extend Forwardable

        def_delegators :@nm_client, :active_connections, :on_connection_added,
          :on_connection_updated, :on_connection_removed

        # Constructor
        #
        # @param logger [Logger]
      def initialize(logger)
        @logger = logger
        @nm_client = DInstaller::DBus::Clients::NetworkManager.new
      end

      # Probes the network configuration
      def probe
        logger.info "Probing network"
        Yast::Lan.read_config
        settings = Y2Network::ProposalSettings.instance
        settings.apply_defaults
        # force NetworkManager as we are not supporting other backends
        settings.enable_network_manager!
      end

      # Writes the network configuration to the installed system
      def install
        Yast::WFM.CallFunction("save_network", [])
      end

    private

      # @return [Logger]
      attr_reader :logger
    end
  end
end
