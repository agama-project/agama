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

module DInstaller
  module DBus
    module Clients
      # Class used by other DBus services to communicate with users service
      class Users
        def self.write(_progress)
          sysbus = ::DBus.system_bus
          service   = sysbus["org.opensuse.DInstaller.Users"]
          object    = service["/org/opensuse/DInstaller/Users1"]
          interface = object["org.opensuse.DInstaller.Users1"]
          interface.Write
        end
      end
    end
  end
end
