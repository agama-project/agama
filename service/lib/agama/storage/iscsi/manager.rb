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

require "agama/issue"
require "agama/storage/iscsi/adapter"
require "agama/storage/iscsi/config_importer"
require "agama/storage/iscsi/node"
require "yast/i18n"

module Agama
  module Storage
    module ISCSI
      # Manager for iSCSI.
      class Manager
        include Yast::I18n

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

        # @return [Array<Issue>]
        attr_reader :issues

        # @param logger [Logger, nil]
        def initialize(logger: nil)
          @logger = logger || ::Logger.new($stdout)
          @issues = []
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
          @probed = true
          probe_initiator
          probe_nodes
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
        # @return [Boolean] Whether the config was correctly applied.
        def apply_config_json(config_json)
          @config_json = config_json
          config = ConfigImporter.new(config_json).import
          probe_after { apply_config(config) }
        end

      private

        # @return [Logger]
        attr_reader :logger

        # @return [Adapter]
        def adapter
          @adapter ||= Adapter.new
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
          # Locked portals are read only the first time the nodes are probed.
          @locked_portals ||= @nodes.select(&:connected).map(&:portal)
          @locked_portals.each { |p| find_node(p)&.locked = true }
          @nodes
        end

        # Calls the given block and performs iSCSI probing afterwards
        #
        # @note Returns the result of the block.
        # @param block [Proc]
        def probe_after(&block)
          block.call.tap { probe }
        end

        # Applies the given iSCSI config.
        #
        # @param config [ISCSI::Config]
        # @return [Boolean] Whether the config was correctly applied.
        def apply_config(config)
          probe unless probed?
          apply_initiator_config(config)
          apply_targets_config(config)
          @issues.none?
        end

        # Applies the inititator config.
        #
        # @param config [ISCSI::Config]
        def apply_initiator_config(config)
          return unless initiator && config.initiator
          return if initiator.name == config.initiator

          adapter.update_initiator(initiator, name: config.initiator)
        end

        # Applies the target configs.
        #
        # @param config [ISCSI::Config]
        def apply_targets_config(config)
          discover_from_portals(config)
          logout_targets(config)
          login_targets(config)
          update_targets(config)
        end

        # Discovers iSCSI targets from all the portals.
        #
        # @param config [ISCSI::Config]
        def discover_from_portals(config)
          config.portals.each do |portal|
            interfaces = config.interfaces(portal)
            adapter.discover_from_portal(portal, interfaces: interfaces)
          end
        end

        # Tries to logout the targets that are not configured.
        #
        # @param config [ISCSI::Config]
        def logout_targets(config)
          nodes
            .select(&:connected?)
            .reject { |n| config.include_target?(n.portal) }
            .each { |n| adapter.logout(n) }
        end

        # Tries to login the configured targets.
        #
        # @note The login is skipped if the target is already connected. An issue is generated if
        # the login of a target fails.
        #
        # @param config [ISCSI::Config]
        def login_targets(config)
          issues = []

          config.targets
            .reject { |t| connected_target?(t.portal) }
            .each do |target|
              success = apply_target_config(target)
              issues << login_issue(target) unless success
            end

          @issues = issues
        end

        # Applies the given target config.
        #
        # @param target [ISCSI::Configs::Target]
        # @return [Boolean] Whether the config was correctly applied.
        def apply_target_config(target)
          node = ISCSI::Node.new
          node.address = target.address
          node.port = target.port
          node.target = target.name
          node.interface = target.interface

          credentials = {
            username:           target.username,
            password:           target.password,
            initiator_username: target.initiator_username,
            initiator_password: target.initiator_password
          }

          adapter.login(node, credentials: credentials, startup: target.startup)
        end

        # Updates the connected targets if needed.
        #
        # @param config [ISCSI::Config]
        def update_targets(config)
          config.targets
            .select { |t| connected_target?(t.portal) }
            .each do |target|
              node = find_node(target.portal)
              next if node.startup == target.startup
              adapter.update_node(node, startup: target.startup)
            end
        end

        # Whether the target of the given portal is connected.
        #
        # @param portal [String]
        # @return [Boolean]
        def connected_target?(portal)
          find_node(portal)&.connected? || false
        end

        # Finds a node with the given portal.
        #
        # @param portal [String]
        # @return [Node, nil]
        def find_node(portal)
          nodes.find { |n| n.portal == portal }
        end

        # Login issue.
        #
        # @param target [ISCSI::Configs::Target]
        # @return [Issue]
        def login_issue(target)
          Issue.new(format(_("Cannot login to iSCSI target %s"), target.name))
        end
      end
    end
  end
end
