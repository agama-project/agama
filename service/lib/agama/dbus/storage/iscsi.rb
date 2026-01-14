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

require "agama/dbus/base_object"
require "agama/with_progress"
require "dbus"
require "json"
require "yast"

module Agama
  module DBus
    module Storage
      # D-Bus object to manage iSCSI.
      class ISCSI < BaseObject
        include Yast::I18n
        include Agama::WithProgress

        PATH = "/org/opensuse/Agama/Storage1/ISCSI"
        private_constant :PATH

        # @param manager [Agama::Storage::ISCSI::Manager]
        # @param logger [Logger, nil]
        def initialize(manager, logger: nil)
          textdomain "agama"
          super(PATH, logger: logger)
          @manager = manager
          register_progress_callbacks
        end

        dbus_interface "org.opensuse.Agama.Storage1.ISCSI" do
          dbus_method(:GetSystem, "out system:s") { recover_system }
          dbus_method(:GetConfig, "out config:s") { recover_config }
          dbus_method(:SetConfig, "in serialized_config:s, out result:u") do |serialized_config|
            apply_config(serialized_config)
          end
          dbus_method(:Discover, "in options:a{sv}, out result:u") do |serialized_options|
            discover(serialized_options)
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

        def discover(serialized_options)
          options = JSON.parse(serialized_options, symbolize_names: true)
          host = options[:host]
          port = options[:port]
          credentials = {
            username:           options[:username] || "",
            password:           options[:password] || "",
            initiator_username: options[:username] || "",
            initiator_password: options[:username] || ""
          }

          start_progress(1, _("Performing iSCSI discovery"))
          success = manager.discover(host, port, credentials)
          emit_system_changed
          finish_progress

          success ? 0 : 1
        end

      private

        # @return [Agama::Storage::ISCSI::Manager]
        attr_reader :manager

        # Emits the SystemChanged signal
        def emit_system_changed
          self.SystemChanged(recover_system)
        end

        def initiator_json
          {
            name: manager.initiator.name,
            ibft: manager.initiator.ibft_name?
          }
        end

        def targets_json
          manager.nodes.map { |n| target_json(n) }
        end

        def target_json(node)
          {
            name:      node.target,
            address:   node.address,
            port:      node.port,
            interface: node.interface,
            ibtf:      node.ibtf?,
            startup:   node.startup,
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
