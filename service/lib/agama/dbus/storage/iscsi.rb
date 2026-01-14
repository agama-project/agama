# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require "dbus"
require "json"
require "agama/dbus/base_object"
require "agama/with_progress"

module Agama
  module DBus
    module Storage
      # D-Bus object to manage iSCSI.
      class ISCSI < BaseObject
        include Agama::WithProgress

        PATH = "/org/opensuse/Agama/Storage1/ISCSI"
        private_constant :PATH

        # @param manager [Agama::Storage::ISCSI::Manager]
        # @param logger [Logger, nil]
        def initialize(manager, logger: nil)
          super(PATH, logger: logger)
          @manager = manager
          register_progress_callbacks
        end

        dbus_interface "org.opensuse.Agama.Storage1.ISCSI" do
          dbus_method(:GetSystem, "out system:s") { recover_system }
          dbus_method(:GetConfig, "out config:s") { recover_config }
          dbus_method(:SetConfig, "in serialized_config:s, out result:u") do |serialized_config|
            busy_while { apply_config(serialized_config) }
          end
          dbus_signal(:SystemChanged, "system:s")
          dbus_signal(:ProgressChanged, "progress:s")
          dbus_signal(:ProgressFinished)
        end

        # @return [String]
        def recover_system
          manager.probe unless manager.probed?

          json = {
            initiator: initiator_json,
            targets:   targets_json
          }
          JSON.pretty_generate(json)
        end

        # Gets the serialized config.
        #
        # @return [String]
        def recover_config
          JSON.pretty_generate(manager.config_json)
        end

        # Applies the given serialized iSCSI config according to the JSON schema.
        #
        # @todo Raise error if the config is not valid.
        #
        # @param serialized_config [String] Serialized iSCSI config.
        # @return [Integer] 0 success; 1 error
        def apply_config(serialized_config)
          logger.info("Setting iSCSI config from D-Bus: #{serialized_config}")
          config_json = JSON.parse(serialized_config, symbolize_names: true)
          success = manager.apply_config_json(config_json)
          success ? 0 : 1
        end

      private

        # @return [Agama::Storage::ISCSI::Manager]
        attr_reader :manager

        def initiator_json
          {
            name: manager.initiator.name,
            ibtf: manager.initiator.ibtf_name?
          }
        end

        def targets_json
          manager.nodes.map { |n| target_json(n) }
        end

        def target_json(node)
          {
            name: node.target,
            address: node.address,
            port: node.port,
            interface: node.interface,
            ibtf: node.ibtf?,
            startup: node.startup,
            connected: node.connected?
          }
        end

        def register_progress_callbacks
          on_progress_change { self.ProgressChanged(progress.to_json) }
          on_progress_finish { self.ProgressFinished }
        end
      end
    end
  end
end
