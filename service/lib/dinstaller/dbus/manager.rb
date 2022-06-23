# frozen_string_literal: true

# Copyright (c) [2021] SUSE LLC
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

module DInstaller
  module DBus
    # D-Bus object to manage the installation process
    class Manager < ::DBus::Object
      PATH = "/org/opensuse/DInstaller/Manager1"
      private_constant :PATH

      MANAGER_INTERFACE = "org.opensuse.DInstaller.Manager1"
      private_constant :MANAGER_INTERFACE

      # Constructor
      #
      # @param backend [DInstaller::Manager] Installation manager
      # @param logger [Logger]
      def initialize(backend, logger)
        @logger = logger
        @backend = backend

        register_status_callback
        register_progress_callback

        super(PATH)
      end

      dbus_interface MANAGER_INTERFACE do
        dbus_method(:Probe, "") { backend.probe }

        dbus_method(:Commit, "") { backend.install }

        # Current status
        #
        # TODO: these values come from the id of statuses, see {DInstaller::Status::Base}. This
        #   D-Bus class should explicitly convert statuses to integer instead of relying on the id
        #   value, which could change.
        #
        # Possible values:
        #   0 : error
        #   1 : probing
        #   2 : probed
        #   3 : installing
        #   4 : installed
        dbus_reader :status, "u"

        # Error messages when the status is 0
        dbus_reader :error_messages, "as",
          emits_changed_signal: :invalidates

        # Progress has struct with values:
        #   s message
        #   t total major steps to do
        #   t current major step (0-based)
        #   t total minor steps. Can be zero which means no minor steps
        #   t current minor step
        dbus_reader :progress, "(stttt)"
      end

      # Id of the current status
      #
      # @return [Integer]
      def status
        backend.status_manager.status.id
      end

      # Error messages from the error status
      #
      # @return [Array<String>]
      def error_messages
        return [] unless backend.status_manager.error?

        backend.status_manager.status.messages
      end

      # @see DInstaller::Manager#progress
      def progress
        backend.progress.to_a
      end

    private

      # @return [Logger]
      attr_reader :logger

      # @return [DInstaller::Manager]
      attr_reader :backend

      # Registers callback to be called when the status changes
      #
      # The callback will emit a signal
      def register_status_callback
        backend.status_manager.on_change do
          dbus_properties_changed(MANAGER_INTERFACE, { "Status" => status }, ["ErrorMessages"])
        end
      end

      # Registers callback to be called when the progress changes
      #
      # The callback will emit a signal
      def register_progress_callback
        backend.progress.on_change do
          dbus_properties_changed(MANAGER_INTERFACE, { "Progress" => progress }, [])
        end
      end
    end
  end
end
