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

module Agama
  module DBus
    # Represents the status of a D-Installer service and allows to configure callbacks to be called
    # when the status value changes
    class ServiceStatus
      # Possible values of the service status
      IDLE = "idle"
      BUSY = "busy"

      # Constructor
      #
      # The service status is initialized as idle.
      def initialize
        @value = IDLE
        @on_change_callbacks = []
      end

      # Whether the current service status value is busy
      #
      # @return [Boolean]
      def busy?
        value == BUSY
      end

      # Changes the service status value to idle
      #
      # @note Callbacks are called.
      #
      # @return [self]
      def idle
        change_to(IDLE)
        self
      end

      # Changes the service status value to busy
      #
      # @note Callbacks are called.
      #
      # @return [self]
      def busy
        change_to(BUSY)
        self
      end

      # Registers a callback to be called when the service status changes
      #
      # @param block [Proc]
      def on_change(&block)
        @on_change_callbacks << block
      end

    private

      # @return [IDLE, BUSY]
      attr_reader :value

      # Changes the current service status value and runs the callbacks
      #
      # @param value [IDLE, BUSY]
      def change_to(value)
        @value = value
        @on_change_callbacks.each(&:call)
      end
    end
  end
end
