# frozen_string_literal: true

# Copyright (c) [2021-2025] SUSE LLC
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

module Agama
  module DBus
    # Base class for DBus objects
    class BaseObject < ::DBus::Object
      # Constructor
      #
      # @param path [::DBus::ObjectPath]
      # @param logger [Logger, nil]
      def initialize(path, logger: nil)
        @logger = logger || Logger.new($stdout)
        super(path)
      end

    private

      # @return [Logger]
      attr_reader :logger

      # Extra data provided to the D-Bus call (e.g., the client_id requesting the action).
      #
      # @return [Hash]
      def request_data
        @request_data ||= {}
      end

      # Executes a block ensuring the given request data is available during the process.
      #
      # Saving the request data is needed in order to have it available while emitting signals as
      # part of the block execution.
      #
      # @param data [Hash] Extra data, see {#request_data}.
      # @param block [Proc]
      def request(data = {}, &block)
        @request_data = data
        block.call
      ensure
        @request_data = {}
      end
    end
  end
end
