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
    class IscsiManager

      # Class methods
      class << self
        def instance(logger: logger)
          return @instance if @instance

          create_instance(logger)
        end

        def create_instance(logger = nil)
          @instance = new(logger)
        end

        # Make sure only .instance can be used to create objects
        private :new, :allocate
      end

      # Constructor
      #
      # @param logger [Logger, nil]
      def initialize(logger: nil)
        @logger = logger || ::Logger.new($stdout)
        @probed = false
      end

      def probe
        return if probed?

        # NOTE: check call to IscsiClientLib.load_modules at widgets.rb

        # Why we need to sleep every now and then? We copied that from yast2-iscsi-client
        sl = 0.5

        logger.info "Read information from the iBFT"
        Yast::IscsiClientLib.getiBFT
        sleep(sl)

        # Check initiatorname, creating one if missing
        logger.info "Check initiator name"
        # Or maybe add a silent attribute to IscsiClientLib and set it at the beginning of D-Installer
        return false unless Yast::IscsiClientLib.checkInitiatorName(silent: true)
        sleep(sl)

        logger.info "Try auto-login to targets configured via iBFT"
        Yast::IscsiClientLib.autoLogOn
        sleep(sl)

        @probed = true
        read_sessions
        read_discovered
      end

      def probed?
        !!@probed
      end

      def sessions
        raise Whatever if @sessions.nil?

        @sessions.values
      end

      def read_sessions
        raise Whatever unless probed?

        logger.info "Read the current iSCSI sessions"
        Yast::IscsiClientLib.readSessions
        @sessions = {}
        Yast::IscsiClientLib.sessions.map do |session_str|
          @sessions[session_str] = Iscsi::Node.new_from_yast_session(session_str.split(" "))
        end
      end

      def discovered
        raise Whatever if @discovered.nil?

        @discovered.values
      end

      def read_discovered
        raise Whatever unless probed?

        logger.info "Read the discovered targets"
        @discovered = {}
        Yast::IscsiClientLib.getDiscovered.map do |target_str|
          node = find_session(target_str)
          node ||= Iscsi::Node.new_from_yast_discovered(target_str.split(" "), )
          @discovered[target_str] = node
        end
      end

      def initiator
        Iscsi::Initiator.new
      end

      # Based on provided address and port, ie. assuming ISNS is not used.
      # Since YaST do not offer UI to configure ISNS during installation, we are assuming
      # it's not supported.
      def discover_send_targets(host, port, authentication)
        Yast::IscsiClientLib.discover(host, port, authentication)
        read_discovered
      end

      def login(node, authentication)
        Yast::IscsiClientLib.currentRecord = node.to_yast
        Yast::IscsiClientLib.login_into_current(authentication, silent: true)
        read_sessions
        read_discovered
      end

      def logout(node)
        Yast::IscsiClientLib.currentRecord = node.to_yast
        # Yes, this is the correct method name for logging out
        Yast::IscsiClientLib.deleteRecord
        read_sessions
        read_discovered
      end

      def delete(node)
        Yast::IscsiClientLib.currentRecord = node.to_yast
        Yast::IscsiClientLib.removeRecord
        read_sessions
        read_discovered
      end

    private

      attr_reader :logger

      def find_session(target_str) 
        Yast::IscsiClientLib.currentRecord = target_str.split(" ")
        session_str = Yast::IscsiClientLib.find_session(true)
        session_str ? @sessions[session_str] : nil
      end
    end
  end
end
