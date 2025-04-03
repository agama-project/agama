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
require "agama/with_progress"

module Agama
  module Storage
    module ISCSI
      # Manager for iSCSI.
      class Manager
        include WithProgress

        STARTUP_OPTIONS = ["onboot", "manual", "automatic"].freeze

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
          @on_sessions_change_callbacks = []
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
          probe_initiator
          probe_nodes
          @on_probe_callbacks.each(&:call)
        end

        # @todo
        def apply_config(_config_json)
          logger.info("Not implemented yet")
          false
        end

        # Updates the initiator info.
        #
        # @param name [String, nil]
        # @param offload_card [String, nil]
        def update_initiator(name: nil, offload_card: nil)
          return unless initiator

          adapter.update_initiator(initiator, name: name, offload_card: offload_card)
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

        # Calls activation if needed
        def ensure_activated
          activate unless activated?
        end

        # Whether activation has been already performed
        #
        # @return [Boolean]
        def activated?
          !!@activated
        end

        def probe_initiator
          @initiator = adapter.read_initiator
        end

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
      end
    end
  end
end
