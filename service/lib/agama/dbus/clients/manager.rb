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

require "agama/dbus/clients/base"
require "agama/dbus/clients/with_service_status"
require "agama/dbus/clients/with_progress"
require "agama/dbus/manager"
require "agama/installation_phase"

module Agama
  module DBus
    module Clients
      # D-Bus client for manager service
      class Manager < Base
        include WithServiceStatus
        include WithProgress

        def initialize
          super

          @dbus_object = service["/org/opensuse/Agama/Manager1"]
          @dbus_object.introspect
        end

        def service_name
          @service_name ||= "org.opensuse.Agama.Manager1"
        end

        def probe
          dbus_object.Probe
        end

        # Starts the installation
        def commit
          dbus_object.Commit
        end

        def current_installation_phase
          dbus_phase = dbus_object["org.opensuse.Agama.Manager1"]["CurrentInstallationPhase"]

          case dbus_phase
          when DBus::Manager::STARTUP_PHASE
            InstallationPhase::STARTUP
          when DBus::Manager::CONFIG_PHASE
            InstallationPhase::CONFIG
          when DBus::Manager::INSTALL_PHASE
            InstallationPhase::INSTALL
          end
        end

      private

        # @return [::DBus::Object]
        attr_reader :dbus_object
      end
    end
  end
end
