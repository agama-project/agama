# frozen_string_literal: true

# Copyright (c) [2022-2025] SUSE LLC
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

require "agama/dbus/service_status"

module Agama
  module DBus
    # Mixin to be included by D-Bus objects that needs to register a service status.
    module WithServiceStatus
      # Service status
      #
      # @return [ServiceStatus]
      def service_status
        @service_status ||= ServiceStatus.new.idle
      end

      # Sets the service status to busy meanwhile the given block is running
      #
      # @param block [Proc]
      # @return [Object] the result of the given block
      def busy_while(&block)
        service_status.busy_while(&block)
      end

      # Executes a block setting the service as busy, see {BaseObject#request}.
      #
      # @param data [Hash] see {BaseObject#request_data}.
      # @param block [Proc]
      def busy_request(data, &block)
        busy_while { request(data, &block) }
      end
    end
  end
end
