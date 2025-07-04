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
require "agama/with_issues"
require "agama/with_progress"
require "yast/i18n"

module Agama
  module Storage
    module ISCSI
      # Manager for iSCSI.
      class Manager
        include WithIssues
        include WithProgress
        include Yast::I18n

        STARTUP_OPTIONS = ["onboot", "manual", "automatic"].freeze
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

        # @param progress_manager [ProgressManager, nil]
        # @param logger [Logger, nil]
        def initialize(progress_manager: nil, logger: nil)
          @progress_manager = progress_manager
          @logger = logger || ::Logger.new($stdout)
          @nodes = []
          @on_activate_callbacks = []
          @on_probe_callbacks = []
          # Sets iSCSI as configured after any change on the sessions.
          @on_sessions_change_callbacks = [proc { @configured = true }]
        end

        # Whether iSCSI was configured.
        #
        # @return [Boolean]
        def configured?
          !!@configured
        end

        # Performs actions for activating iSCSI.
        #
        # Callbacks are called at the end, see {#on_probe}.
        def activate
          logger.info "Activating iSCSI"
          @activated = true
          adapter.activate
          @on_activate_callbacks.each(&:call)
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
          ensure_activated
          probe_after { adapter.discover(host, port, credentials: credentials) }
        end

        # Probes iSCSI.
        #
        # Callbacks are called at the end, see {#on_probe}.
        def probe
          logger.info "Probing iSCSI"
          @probed = true
          probe_initiator
          probe_nodes
          @on_probe_callbacks.each(&:call)
        end

        # Applies the given iSCSI config.
        #
        # @param config_json [Hash{Symbol=>Object}] Config according to the JSON schema.
        # @return [Boolean] Whether the config was correctly applied.
        def apply_config_json(config_json)
          @config_json = config_json
          config = ConfigImporter.new(config_json).import

          success = probe_after { apply_config(config) }
          run_on_sessions_change_callbacks if config.targets

          success
        end

        # Updates the initiator info.
        #
        # @param name [String, nil]
        def update_initiator(name: nil)
          return unless initiator

          adapter.update_initiator(initiator, name: name)
          probe_initiator
        end

        # Creates a new iSCSI session.
        # @note iSCSI nodes are probed again, see {#probe_after}.
        #
        # @param node [Node]
        # @param credentials [Hash<Symbol, String>]
        #   @option username [String]
        #   @option password [String]
        #   @option initiator_username [String]
        #   @option initiator_password [String]
        # @param startup [String, nil] Startup status
        #
        # @return [Boolean] Whether the action successes
        def login(node, credentials: {}, startup: nil)
          ensure_activated
          result = probe_after { adapter.login(node, credentials: credentials, startup: startup) }
          run_on_sessions_change_callbacks
          result
        end

        # Closes an iSCSI session.
        # @note iSCSI nodes are probed again, see {#probe_after}.
        #
        # @param node [Node]
        # @return [Boolean] Whether the action successes
        def logout(node)
          ensure_activated
          result = probe_after { adapter.logout(node) }
          run_on_sessions_change_callbacks
          result
        end

        # Deletes an iSCSI node from the database.
        # @note iSCSI nodes are probed again, see {#probe_after}.
        #
        # @param node [Node]
        # @return [Boolean] Whether the action successes
        def delete(node)
          probe_after { adapter.delete_node(node) }
        end

        # Updates an iSCSI node.
        #
        # @param node [Node]
        # @param startup [String] New startup mode value
        #
        # @return [Boolean] Whether the action successes
        def update(node, startup:)
          probe_after { adapter.update_node(node, startup: startup) }
        end

        # Registers a callback to be called after performing iSCSI activation
        #
        # @param block [Proc]
        def on_activate(&block)
          @on_activate_callbacks << block
        end

        # Registers a callback to be called when the nodes are probed
        #
        # @param block [Proc]
        def on_probe(&block)
          @on_probe_callbacks << block
        end

        # Registers a callback to be called when a session changes
        #
        # @param block [Proc]
        def on_sessions_change(&block)
          @on_sessions_change_callbacks << block
        end

      private

        # @return [Logger]
        attr_reader :logger

        # @return [Adapter]
        def adapter
          @adapter ||= Adapter.new
        end

        # Whether activation has been already performed
        #
        # @return [Boolean]
        def activated?
          !!@activated
        end

        # Whether probing has been already performed.
        #
        # @return [Boolean]
        def probed?
          !!@probed
        end

        # Calls activation if needed
        def ensure_activated
          activate unless activated?
        end

        # Calls probing (and activation) if needed.
        def ensure_probed
          activate unless activated?
          probe unless probed?
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
        end

        # Calls the given block and performs iSCSI probing afterwards
        #
        # @note Returns the result of the block.
        # @param block [Proc]
        def probe_after(&block)
          block.call.tap { probe }
        end

        # Runs callbacks when a session changes
        def run_on_sessions_change_callbacks
          @on_sessions_change_callbacks.each(&:call)
        end

        # Applies the given iSCSI config.
        #
        # @param config [ISCSI::Config]
        # @return [Boolean] Whether the config was correctly applied.
        def apply_config(config)
          ensure_probed
          apply_initiator_config(config)
          apply_targets_config(config)

          issues.none?
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
          return unless config.targets

          start_progress_with_size(3)
          progress.step(_("Logout iSCSI targets")) { logout_targets }
          progress.step(_("Discover iSCSI targets")) { discover_from_portals(config) }
          progress.step(_("Login iSCSI targets")) { login_targets(config) }
        end

        # Tries to logout from all targets (nodes).
        def logout_targets
          nodes.select(&:connected?).each { |n| adapter.logout(n) }
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

        # Tries to login to all targets.
        #
        # @note If the login of a target fails, then an issue is generated. The process stops on
        #   the first failing login.
        #
        # @param config [ISCSI::Config]
        def login_targets(config)
          issues = []

          config.targets.each do |target|
            success = apply_target_config(target)
            if !success
              issues << login_issue(target)
              break
            end
          end

          self.issues = issues
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

        # Login issue.
        #
        # @param target [ISCSI::Configs::Target]
        # @return [Issue]
        def login_issue(target)
          Issue.new(format(_("Cannot login to iSCSI target %s"), target.name),
            source:   Issue::Source::CONFIG,
            severity: Issue::Severity::ERROR)
        end
      end
    end
  end
end
