# frozen_string_literal: true

# Copyright (c) [2022-2024] SUSE LLC
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
require "agama/dbus/clients/with_locale"
require "agama/dbus/clients/with_progress"
require "agama/dbus/clients/with_issues"

module Agama
  module DBus
    module Clients
      # D-Bus client for storage configuration
      class Storage < Base
        include WithLocale
        include WithServiceStatus
        include WithProgress
        include WithIssues

        STORAGE_IFACE = "org.opensuse.Agama.Storage1"
        private_constant :STORAGE_IFACE

        def service_name
          @service_name ||= "org.opensuse.Agama.Storage1"
        end

        # Starts the probing process
        #
        # If a block is given, the method returns immediately and the probing is performed in an
        # asynchronous way.
        #
        # @param done [Proc] Block to execute once the probing is done
        def probe(&done)
          dbus_object[STORAGE_IFACE].Probe(&done)
        end

        # Performs the packages installation
        def install
          dbus_object.Install
        end

        # Cleans-up the storage stuff after installation
        def finish
          dbus_object.Finish
        end

      private

        # @return [::DBus::Object]
        def dbus_object
          @dbus_object ||= service["/org/opensuse/Agama/Storage1"].tap(&:introspect)
        end
      end
    end
  end
end
