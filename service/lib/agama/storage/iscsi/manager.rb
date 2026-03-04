# frozen_string_literal: true

# Copyright (c) [2023-2025] SUSE LLC
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

require "agama/storage/iscsi/adapter"
require "agama/storage/iscsi/config_importer"
require "agama/storage/iscsi/node"

module Agama
  module Storage
    module ISCSI
      # Manager for iSCSI.
      class Manager
        PACKAGES = ["open-iscsi", "iscsiuio"].freeze

        # Config according to the JSON schema.
        #
        # @return [Hash, nil]
        attr_reader :config_json

        # iSCSI initiator.
        #
        # @return [Initiator, nil]
        attr_reader :initiator

        # Discovered iSCSI nodes.
        #
        # @return [Array<Node>]
        attr_reader :nodes

        # @param logger [Logger, nil]
        def initialize(logger: nil)
          @logger = logger || ::Logger.new($stdout)
          @nodes = []
        end

        # Whether probing has been already performed.
        #
        # @return [Boolean]
        def probed?
          !!@probed
        end

        # Probes iSCSI.
        def probe
          probe_initiator
          probe_nodes
          @probed = true
        end

        # Performs an iSCSI discovery.
        # @note iSCSI nodes are probed again, see {#probe_after}.
        #
        # @param host [String] IP address
        # @param port [Integer]
        # @param credentials [Hash<Symbol, String>]
        #   @option username [String]
        #   @option password [String]
        #   @option initiator_username [String]
        #   @option initiator_password [String]
        #
        # @return [Boolean] Whether the action successes
        def discover(host, port, credentials: {})
          probe_after { adapter.discover(host, port, credentials: credentials) }
        end

        # Applies the given iSCSI config.
        #
        # @param config_json [Hash{Symbol=>Object}] Config according to the JSON schema.
        # @return [Boolean] Whether the iSCSI system was changed.
        def configure(config_json)
          probe unless probed?
          config = assign_config(config_json)

          initiator = self.initiator
          nodes = self.nodes

          probe_after do
            configure_initiator(config)
            discover_from_portals(config)
            disconnect_missing_targets(config)
            configure_targets(config)
          end

          system_changed?(initiator, nodes)
        end

        # Whether the system is already configured for the given config.
        #
        # @param config_json [Hash]
        # @return [Boolean]
        def configured?(config_json)
          config = ConfigImporter.new(config_json).import
          initiator_configured?(config) && nodes_configured?(config)
        end

      private

        # @return [Logger]
        attr_reader :logger

        # @return [Config, nil]
        attr_reader :previous_config

        # @return [Adapter]
        def adapter
          @adapter ||= Adapter.new
        end

        # Sets the new config and keeps the previous one.
        #
        # @param config_json [Hash{Symbol=>Object}] Config according to the JSON schema.
        # @return [Config]
        def assign_config(config_json)
          @previous_config = @config
          @config_json = config_json
          @config = ConfigImporter.new(config_json).import
        end

        # Calls the given block and performs iSCSI probing afterwards
        #
        # @note Returns the result of the block.
        # @param block [Proc]
        def probe_after(&block)
          block.call.tap { probe }
        end

        # Probes the initiator.
        #
        # @return [ISCSI::Initiator]
        def probe_initiator
          @initiator = adapter.read_initiator
        end

        # Probes the iSCSI nodes (a.k.a., targets).
        #
        # @return [Array<ISCSI::Node>]
        def probe_nodes
          @nodes = adapter.read_nodes
          # Nodes are set as locked if they are already connected at the time of probing for first
          # time. This usually happens when there is iBFT activation or the targets are manually
          # connected (e.g., by using a script).
          init_locked_nodes(@nodes.select(&:connected)) unless probed?
          locked_nodes.each { |n| n.locked = true }
          @nodes
        end

        # Whether the initiator is already configured for the given config.
        #
        # @param config [Config]
        # @return [Boolean]
        def initiator_configured?(config)
          return true unless config.initiator

          initiator&.name == config.initiator
        end

        # Whether all the nodes are already configured for the given config.
        #
        # @param config [Config]
        # @return [Boolean]
        def nodes_configured?(config)
          nodes.all? { |n| node_configured?(n, config) }
        end

        # Whether the node is already configured for the given config.
        #
        # @param node [Node]
        # @param config [Config]
        #
        # @return [Boolean]
        def node_configured?(node, config)
          target_config = config.find_target(node.target, node.portal)

          if target_config
            node.connected? &&
              !credentials_changed?(target_config) &&
              !startup_changed?(target_config)
          else
            !node.connected || node.locked?
          end
        end

        # Whether the system has changed.
        #
        # @param initiator [Initiator]
        # @param nodes [Array<Node>]
        def system_changed?(initiator, nodes)
          self.initiator != initiator || self.nodes != nodes
        end

        # Configures the initiator.
        #
        # @param config [ISCSI::Config]
        def configure_initiator(config)
          return if initiator_configured?(config)

          adapter.update_initiator(initiator, name: config.initiator)
        end

        # Discovers iSCSI targets from all the portals.
        #
        # @param config [ISCSI::Config]
        def discover_from_portals(config)
          config.portals.each do |portal|
            interfaces = config.interfaces(portal)
            adapter.discover_from_portal(portal, interfaces: interfaces)
          end
          probe_nodes
        end

        # Disconnects the targets that are not configured, preventing to disconnect locked targets.
        #
        # @param config [ISCSI::Config]
        def disconnect_missing_targets(config)
          nodes
            .select(&:connected?)
            .reject(&:locked?)
            .reject { |n| config.include_target?(n.target, n.portal) }
            .each { |n| disconnect_node(n) }
        end

        # Configures the targets.
        #
        # @param config [ISCSI::Config]
        def configure_targets(config)
          config.targets.each { |t| configure_target(t) }
        end

        # Configures a target.
        #
        # @param target_config [ISCSI::Configs::Target]
        def configure_target(target_config)
          node = find_node(target_config)
          return unless node

          if node.connected?
            configure_connected_node(node, target_config)
          else
            connect_node(node, target_config)
          end
        end

        # Configures a node that is already connected.
        #
        # @param node [Node]
        # @param target_config [ISCSI::Configs::Target]
        def configure_connected_node(node, target_config)
          if credentials_changed?(target_config)
            reconnect_node(node, target_config)
          elsif startup_changed?(target_config)
            update_node(node, target_config)
          end
        end

        # Tries to connect a node.
        #
        # @param node [Node]
        # @param target_config [ISCSI::Configs::Target]
        #
        # @return [Boolean] Whether the node was connected.
        def connect_node(node, target_config)
          logger.info("Connecting iSCSI node: #{node.inspect}")
          adapter.login(
            node,
            credentials: target_config.credentials || {},
            startup:     target_config.startup
          )
        end

        # Tries to disconnect a node.
        #
        # @param node [Node]
        # @return [Boolean] Whether the node was disconnected.
        def disconnect_node(node)
          logger.info("Disconnecting iSCSI node: #{node.inspect}")
          adapter.logout(node).tap do |success|
            # Unlock the node if it was correctly disconnected.
            unregister_locked_node(node) if success
          end
        end

        # Tries to reconnect a node.
        #
        # @param node [Node]
        # @param target_config [ISCSI::Configs::Target]
        #
        # @return [Boolean] Whether the node was reconnected.
        def reconnect_node(node, target_config)
          disconnect_node(node) && connect_node(node, target_config)
        end

        # Tries to update a node.
        #
        # @param node [Node]
        # @param target_config [ISCSI::Configs::Target]
        #
        # @return [Boolean] Whether the node was updated.
        def update_node(node, target_config)
          logger.info("Updating iSCSI node: #{node.inspect}")
          adapter.update_node(node, startup: target_config.startup)
        end

        # Whether the credentials has changed.
        #
        # @param target_config [ISCSI::Configs::Target]
        # @return [Boolean]
        def credentials_changed?(target_config)
          previous_credentials = find_previous_target(target_config)&.credentials
          previous_credentials != target_config.credentials
        end

        # Whether the startup mode has changed.
        #
        # @param target_config [ISCSI::Configs::Target]
        # @return [Boolean]
        def startup_changed?(target_config)
          previous_startup = find_node(target_config)&.startup
          previous_startup != target_config.startup
        end

        # Finds the equivalent target in the previous configuration, if any.
        #
        # @param target_config [ISCSI::Configs::Target]
        # @return [ISCSI::Configs::Target, nil]
        def find_previous_target(target_config)
          previous_config&.find_target(target_config.name, target_config.portal)
        end

        # Finds the node corresponding to the given target configuration.
        #
        # @param target_config [ISCSI::Configs::Target]
        # @return [Node, nil]
        def find_node(target_config)
          nodes.find { |n| n.target == target_config.name && n.portal == target_config.portal }
        end

        # Nodes that should be marked as locked according to the status of the system in the first
        # probe, no matter the value of their Node#locked attribute
        #
        # @return [Array<Node>]
        def locked_nodes
          @locked_node_ids.map do |i|
            nodes.find { |n| n.target == i[:target] && n.portal == i[:portal] }
          end.compact
        end

        # Method to be called during the initial probing in order to identify the nodes that
        # should be marked as locked.
        #
        # @param nodes [Array<Node>]
        def init_locked_nodes(nodes)
          @locked_node_ids = []
          nodes.each { |n| register_locked_node(n) }
        end

        # @see #locked_nodes
        #
        # @param node [Node]
        def register_locked_node(node)
          @locked_node_ids ||= []
          @locked_node_ids << { target: node.target, portal: node.portal }
        end

        # @see #locked_nodes
        #
        # @param node [Node]
        def unregister_locked_node(node)
          return unless @locked_node_ids

          @locked_node_ids.delete({ target: node.target, portal: node.portal })
        end
      end
    end
  end
end
