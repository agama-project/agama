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

require "agama/storage/iscsi/initiator"
require "agama/storage/iscsi/node"
require "yast"
require "yast2/execute"
require "y2iscsi_client/authentication"

Yast.import "IscsiClientLib"
Yast.import "Service"

module Agama
  module Storage
    module ISCSI
      # This class is a wrapper over the YaST code dealing with iSCSI.
      class Adapter
        # Performs actions for activating iSCSI.
        def activate
          Yast::IscsiClientLib.getiBFT
          # Check initiator name, creating one if missing.
          return false unless Yast::IscsiClientLib.checkInitiatorName(silent: true)

          start_services
          # Why we need to sleep here? This was copied from yast2-iscsi-client.
          sleep(0.5)
          Yast::IscsiClientLib.getConfig
          Yast::IscsiClientLib.autoLogOn
          # We are already logged into the iSCSI targets. But device detection in the kernel is
          # asynchronous, so let's wait until the corresponding iSCSI devices really appear in
          # the system (so yast-storage-ng can handle them).
          Yast::Execute.locally("/usr/bin/udevadm", "settle", "--timeout=20")
        end

        # Performs an iSCSI discovery.
        #
        # Based on provided address and port, ie. assuming ISNS is not used. Since YaST do not offer
        # UI to configure ISNS during installation, we are assuming it's not supported.
        #
        # @param host [String] IP address.
        # @param port [Integer]
        # @param credentials [Hash<Symbol, String>]
        #   @option username [String]
        #   @option password [String]
        #   @option initiator_username [String]
        #   @option initiator_password [String]
        #
        # @return [Boolean] Whether the action successes
        def discover(host, port, credentials: {})
          Yast::IscsiClientLib.discover(host, port, authentication(credentials), silent: true)
        end

        # Discovers iSCSI targets from a portal.
        #
        # @param portal [String]
        # @param interfaces [Array<String>]
        def discover_from_portal(portal, interfaces: [])
          Yast::IscsiClientLib.discover_from_portal(portal, interfaces)
        end

        # Reads the iSCSI initiator config.
        # @return [Initiator]
        def read_initiator
          Initiator.new.tap do |initiator|
            initiator.name = Yast::IscsiClientLib.initiatorname
            initiator.ibft_name = !Yast::IscsiClientLib.getiBFT["iface.initiatorname"].to_s.empty?
          end
        end

        # Updates the initiator info.
        #
        # @param initiator [Initiator]
        # @param name [String, nil]
        def update_initiator(initiator, name: nil)
          update_name = name && name != initiator.name
          Yast::IscsiClientLib.writeInitiatorName(name) if update_name
        end

        # Reads the discovered iSCSI nodes.
        # @return [Array<Node>]
        def read_nodes
          Yast::IscsiClientLib.readSessions
          Yast::IscsiClientLib.getDiscovered.map { |t| node_from(t.split) }
        end

        # Creates a new iSCSI session.
        #
        # @param node [Node]
        # @param credentials [Hash<Symbol, String>]
        #   @option username [String]
        #   @option password [String]
        #   @option initiator_username [String]
        #   @option initiator_password [String]
        # @param startup [String, nil]
        #
        # @return [Boolean] Whether the action successes.
        def login(node, credentials: {}, startup: nil)
          startup ||= Yast::IscsiClientLib.default_startup_status

          Yast::IscsiClientLib.currentRecord = record_from(node)
          Yast::IscsiClientLib.login_into_current(authentication(credentials), silent: true) &&
            Yast::IscsiClientLib.setStartupStatus(startup)
        end

        # Closes an iSCSI session.
        #
        # @param node [Node]
        # @return [Boolean] Whether the action successes.
        def logout(node)
          Yast::IscsiClientLib.currentRecord = record_from(node)
          # Yes, this is the correct method name for logging out
          Yast::IscsiClientLib.deleteRecord
        end

        # Deletes an iSCSI node from the database.
        #
        # @param node [Node]
        # @return [Boolean] Whether the action successes
        def delete_node(node)
          Yast::IscsiClientLib.currentRecord = record_from(node)
          Yast::IscsiClientLib.removeRecord
        end

        # Updates an iSCSI node.
        #
        # @param node [Node]
        # @param startup [String] New startup mode value.
        #
        # @return [Boolean] Whether the action successes.
        def update_node(node, startup:)
          Yast::IscsiClientLib.currentRecord = record_from(node)
          Yast::IscsiClientLib.setStartupStatus(startup)
        end

      private

        # Starts the iSCSI services.
        #
        # To be precise, it actually restarts the services, in case any of them was already running
        # for whatever reason.
        def start_services
          Yast::Service.restart("iscsi")
          Yast::Service.restart("iscsid")
          Yast::Service.restart("iscsiuio")
        end

        # Creates an iSCSI authentication object.
        #
        # @param credentials [Hash<Symbole, String>]
        #   @option username [String] Username for authentication by target
        #   @option password [String] Password for authentication by target
        #   @option initiator_username [String] Username for authentication by initiator
        #   @option initiator_password [String] Password for authentication by inititator
        #
        # @return [Y2IscsiClient::Authentication]
        def authentication(credentials)
          Y2IscsiClient::Authentication.new.tap do |auth|
            auth.username = credentials[:username]
            auth.password = credentials[:password]
            auth.username_in = credentials[:initiator_username]
            auth.password_in = credentials[:initiator_password]
          end
        end

        # Creates a node from the record provided by YaST.
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

        # Finds a session for the given iSCSI record.
        #
        # @param record [Array] Contains portal, target and interface of the iSCSI node.
        # @return [Array, nil] Record for the iSCSI session.
        def find_session_for(record)
          Yast::IscsiClientLib.currentRecord = record
          Yast::IscsiClientLib.find_session(true)&.split
        end

        # Generates a YaST record from a node.
        #
        # @param node [Node]
        # @return [Array]
        def record_from(node)
          [node.portal, node.target, node.interface]
        end
      end
    end
  end
end
