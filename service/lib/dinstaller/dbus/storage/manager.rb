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
require "dinstaller/dbus/base_object"
require "dinstaller/dbus/with_service_status"
require "dinstaller/dbus/interfaces/progress"
require "dinstaller/dbus/interfaces/service_status"

module DInstaller
  module DBus
    module Storage
      # D-Bus object to manage software installation
      class Manager < BaseObject
        include WithServiceStatus
        include Interfaces::Progress
        include Interfaces::ServiceStatus

        PATH = "/org/opensuse/DInstaller/Storage1"
        private_constant :PATH

        # Constructor
        #
        # @param backend [DInstaller::Storage::Manager]
        # @param logger [Logger]
        def initialize(backend, logger)
          super(PATH, logger: logger)
          @backend = backend
          register_progress_callbacks
          register_service_status_callbacks
        end

        STORAGE_INTERFACE = "org.opensuse.DInstaller.Storage1"
        private_constant :STORAGE_INTERFACE

        dbus_interface STORAGE_INTERFACE do
          dbus_method(:Probe) { probe }
          dbus_method(:Install) { install }
          dbus_method(:Finish) { finish }
        end

        def probe
          busy_while { backend.probe }
        end

        def install
          busy_while { backend.install }
        end

        def finish
          busy_while { backend.finish }
        end

      private

        # @return [DInstaller::Software::Manager]
        attr_reader :backend
      end
    end
  end
end
