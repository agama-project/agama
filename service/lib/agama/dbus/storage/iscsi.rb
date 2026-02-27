# frozen_string_literal: true

# Copyright (c) [2025-2026] SUSE LLC
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
          @serialized_system = serialize_system
          @serialized_config = serialize_config
          register_progress_callbacks
        end

        dbus_interface "org.opensuse.Agama.Storage1.ISCSI" do
          dbus_reader_attr_accessor :serialized_system, "s", dbus_name: "System"
          dbus_reader_attr_accessor :serialized_config, "s", dbus_name: "Config"
          dbus_method(:SetConfig, "in serialized_config:s") do |serialized_config|
            configure(serialized_config)
          end
          dbus_method(:Discover, "in serialized_options:s, out result:u") do |serialized_options|
            discover(serialized_options)
          end
          dbus_signal(:SystemChanged, "serialized_system:s")
          dbus_signal(:ProgressChanged, "serialized_progress:s")
          dbus_signal(:ProgressFinished)
        end

        # Applies the given serialized iSCSI config.
        #
        # @todo Raise error if the config is not valid.
        #
        # @param serialized_config [String] Serialized iSCSI config according to the JSON schema.
        def configure(serialized_config)
          config_json = JSON.parse(serialized_config, symbolize_names: true)

          # Do not configure if there is no config
          return unless config_json

          # Do not configure if there is nothing to change.
          return if manager.configured?(config_json)

          logger.info("Configuring iSCSI")

          start_progress(1, _("Configuring iSCSI"))
          manager.configure(config_json)
          update_serialized_system
          update_serialized_config
          finish_progress
        end

        # Performs an iSCSI discovery.
        #
        # @param serialized_options [String] Serialized dicovery options.
        # @return [Number] 0 success; 1 failure.
        def discover(serialized_options)
          logger.info("Discovering iSCSI targets")

          options = JSON.parse(serialized_options, symbolize_names: true)

          address = options[:address]
          port = options[:port]
          credentials = {
            username:           options[:username],
            password:           options[:password],
            initiator_username: options[:initiatorUsername],
            initiator_password: options[:initiatorPassword]
          }

          start_progress(1, _("Performing iSCSI discovery"))
          success = manager.discover(address, port, credentials: credentials)
          update_serialized_system
          finish_progress

          success ? 0 : 1
        end

      private

        # @return [Agama::Storage::ISCSI::Manager]
        attr_reader :manager

        def register_progress_callbacks
          on_progress_change { self.ProgressChanged(progress.to_json) }
          on_progress_finish { self.ProgressFinished }
        end

        # Updates the system info if needed.
        def update_serialized_system
          serialized_system = serialize_system
          return if self.serialized_system == serialized_system

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_system = serialized_system
          self.SystemChanged(serialized_system)
        end

        # Updates the config info if needed.
        def update_serialized_config
          serialized_config = serialize_config
          return if self.serialized_config == serialized_config

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_config = serialized_config
        end

        # Generates the serialized JSON of the system.
        #
        # @return [String]
        def serialize_system
          manager.probe unless manager.probed?

          json = {
            initiator: initiator_json,
            targets:   targets_json
          }
          JSON.pretty_generate(json)
        end

        # Generates the serialized JSON of the config.
        #
        # @return [String]
        def serialize_config
          JSON.pretty_generate(manager.config_json)
        end

        # @return [Hash]
        def initiator_json
          {
            name: manager.initiator&.name,
            ibft: manager.initiator&.ibft_name? || false
          }
        end

        # @return [Hash]
        def targets_json
          manager.nodes.map { |n| target_json(n) }
        end

        # @param node [ISCSI::Node]
        # @return [Hash]
        def target_json(node)
          {
            name:      node.target,
            address:   node.address,
            port:      node.port,
            interface: node.interface,
            ibft:      node.ibft?,
            startup:   node.startup,
            connected: node.connected?,
            locked:    node.locked?
          }
        end
      end
    end
  end
end
