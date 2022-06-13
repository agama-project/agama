# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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
require "dinstaller/manager"
require "dinstaller/dbus/manager"
require "dinstaller/dbus/language"
require "dinstaller/dbus/software"
require "dinstaller/dbus/storage/proposal"
require "dinstaller/dbus/storage/actions"
require "dinstaller/dbus/questions"

module DInstaller
  module DBus
    # D-Bus service (org.opensuse.DInstaller)
    #
    # It connects to the system D-Bus and answers requests on objects below
    # `/org/opensuse/DInstaller`.
    class ManagerService
      # Service name
      #
      # @return [String]
      SERVICE_NAME = "org.opensuse.DInstaller"
      private_constant :SERVICE_NAME

      # System D-Bus
      #
      # @return [::DBus::Connection]
      attr_reader :bus

      # Installation manager
      #
      # @return [DInstaller::Manager]
      attr_reader :manager

      # @param config [Config] Configuration
      # @param logger [Logger]
      def initialize(config, logger = nil)
        @manager = DInstaller::Manager.new(config, logger)
        @logger = logger || Logger.new($stdout)
        @bus = ::DBus::SystemBus.instance
      end

      # Initializes and exports the D-Bus API
      #
      # * Set up the environment (Manager#setup)
      # * Export the D-Bus API
      # * Run the probing phase
      def start
        manager.setup
        export
        manager.probe
        manager.progress.on_change { dispatch } # make single thread more responsive
      end

      # Exports the installer object through the D-Bus service
      def export
        dbus_objects.each { |o| service.export(o) }

        paths = dbus_objects.map(&:path).join(", ")
        logger.info "Exported #{paths} objects"
      end

      # Call this from some main loop to dispatch the D-Bus messages
      def dispatch
        bus.dispatch_message_queue
      end

    private

      # @return [Logger]
      attr_reader :logger

      # @return [::DBus::Service]
      def service
        @service ||= bus.request_service(SERVICE_NAME)
      end

      # @return [Array<::DBus::Object>]
      def dbus_objects
        @dbus_objects ||= [
          manager_dbus,
          language_dbus,
          software_dbus,
          storage_proposal_dbus,
          storage_actions_dbus,
          questions_dbus
        ]
      end

      def manager_dbus
        @manager_dbus ||= DInstaller::DBus::Manager.new(manager, logger)
      end

      def language_dbus
        @language_dbus ||= DInstaller::DBus::Language.new(manager.language, logger)
      end

      def software_dbus
        @software_dbus ||= DInstaller::DBus::Software.new(manager.software, logger)
      end

      def storage_proposal_dbus
        @storage_proposal_dbus ||= DInstaller::DBus::Storage::Proposal.new(
          manager.storage.proposal, storage_actions_dbus, logger
        )
      end

      def storage_actions_dbus
        @storage_actions_dbus ||=
          DInstaller::DBus::Storage::Actions.new(manager.storage.actions, logger)
      end

      def questions_dbus
        @questions_dbus ||= DInstaller::DBus::Questions.new(manager.questions_manager, logger)
      end
    end
  end
end
