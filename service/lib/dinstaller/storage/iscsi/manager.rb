# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

require "yast"
require "dinstaller/storage/iscsi/node"
require "dinstaller/storage/iscsi/initiator"

Yast.import "IscsiClientLib"

module DInstaller
  module Storage
    module ISCSI
      # Manager for iSCSI
      class Manager
        STARTUP_OPTIONS = ["onboot", "manual", "automatic"].freeze

        # iSCSI initiator
        #
        # @return [Initiator]
        attr_reader :initiator

        # Discovered iSCSI nodes
        #
        # @return [Array<Node>]
        attr_reader :nodes

        # Constructor
        #
        # @param logger [Logger, nil]
        def initialize(logger: nil)
          @logger = logger || ::Logger.new($stdout)
          @initiator = ISCSI::Initiator.new

          @on_activate_callbacks = []
          @on_probe_callbacks = []
        end

        # Performs actions for activating iSCSI
        def activate
          logger.info "Activating iSCSI"
          @activated = true

          Yast::IscsiClientLib.getiBFT
          # Check initiator name, creating one if missing
          return false unless Yast::IscsiClientLib.checkInitiatorName(silent: true)

          # Why we need to sleep here? This was copied from yast2-iscsi-client.
          sleep(0.5)
          Yast::IscsiClientLib.getConfig
          Yast::IscsiClientLib.autoLogOn

          @on_activate_callbacks.each(&:call)
        end

        # Probes iSCSI
        #
        # Callbacks are called at the end, see {#on_probe}.
        def probe
          logger.info "Probing iSCSI"

          Yast::IscsiClientLib.readSessions
          @nodes = Yast::IscsiClientLib.getDiscovered.map { |t| node_from(t.split) }

          @on_probe_callbacks.each(&:call)
        end

        # Performs an iSCSI discovery
        #
        # Based on provided address and port, ie. assuming ISNS is not used. Since YaST do not offer
        # UI to configure ISNS during installation, we are assuming it's not supported.
        #
        # @note iSCSI nodes are probed again, see {#probe_after}.
        #
        # @param host [String] IP address
        # @param port [Integer]
        # @param authentication [Y2IscsiClient::Authentication]
        #
        # @return [Boolean] Whether the action successes
        def discover_send_targets(host, port, authentication)
          ensure_activated

          probe_after do
            Yast::IscsiClientLib.discover(host, port, authentication, silent: true)
          end
        end

        # Creates a new iSCSI session
        #
        # @note iSCSI nodes are probed again, see {#probe_after}.
        #
        # @param node [Node]
        # @param authentication [Y2IscsiClient::Authentication]
        # @param startup [String, nil] Startup status
        #
        # @return [Boolean] Whether the action successes
        def login(node, authentication, startup: nil)
          startup ||= Yast::IscsiClientLib.default_startup_status

          ensure_activated

          probe_after do
            Yast::IscsiClientLib.currentRecord = record_from(node)
            Yast::IscsiClientLib.login_into_current(authentication, silent: true) &&
              Yast::IscsiClientLib.setStartupStatus(startup)
          end
        end

        # Closes an iSCSI session
        #
        # @note iSCSI nodes are probed again, see {#probe_after}.
        #
        # @param node [Node]
        # @return [Boolean] Whether the action successes
        def logout(node)
          ensure_activated

          probe_after do
            Yast::IscsiClientLib.currentRecord = record_from(node)
            # Yes, this is the correct method name for logging out
            Yast::IscsiClientLib.deleteRecord
          end
        end

        # Deletes an iSCSI node from the database
        #
        # @note iSCSI nodes are probed again, see {#probe_after}.
        #
        # @param node [Node]
        # @return [Boolean] Whether the action successes
        def delete(node)
          probe_after do
            Yast::IscsiClientLib.currentRecord = record_from(node)
            Yast::IscsiClientLib.removeRecord
          end
        end

        # Updates an iSCSI node
        #
        # @note iSCSI nodes are probed again, see {#probe_after}.
        #
        # @param node [Node]
        # @param startup [String] New startup mode value
        #
        # @return [Boolean] Whether the action successes
        def update(node, startup:)
          probe_after do
            Yast::IscsiClientLib.currentRecord = record_from(node)
            Yast::IscsiClientLib.setStartupStatus(startup)
          end
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

      private

        # @return [Logger]
        attr_reader :logger

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

        # Creates a node from the record provided by YaST
        #
        # @param record [Array] Contains portal, target and interface of the iSCSI node.
        # @return [Node]
        def node_from(record)
          ISCSI::Node.new.tap do |node|
            node.portal = record[0]
            node.target = record[1]
            node.interface = record[2] || "default"
            node.connected = false

            Yast::IscsiClientLib.currentRecord = record
            node.ibtf = Yast::IscsiClientLib.iBFT?(Yast::IscsiClientLib.getCurrentNodeValues)

            session_record = find_session_for(record)

            if session_record
              node.connected = true
              # FIXME: the calculation of both startup and ibft imply executing getCurrentNodeValues
              # (ie. calling iscsiadm)
              Yast::IscsiClientLib.currentRecord = session_record
              node.startup = Yast::IscsiClientLib.getStartupStatus
            end
          end
        end

        # Generates a YaST record from a node
        #
        # @param node [Node]
        # @return [Array]
        def record_from(node)
          [node.portal, node.target, node.interface]
        end

        # Finds a session for the given iSCSI record
        #
        # @param record [Array] Contains portal, target and interface of the iSCSI node.
        # @return [Array, nil] Record for the iSCSI session
        def find_session_for(record)
          Yast::IscsiClientLib.currentRecord = record
          Yast::IscsiClientLib.find_session(true)&.split
        end

        # Calls the given block and performs iSCSI probing afterwards
        #
        # @note Returns the result of the block.
        # @param block [Proc]
        def probe_after(&block)
          block.call.tap { probe }
        end
      end
    end
  end
end
