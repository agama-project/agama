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

require "dbus"

module Agama
  module DBus
    module Storage
      module Interfaces
        # Interface for DM RAID devices
        #
        # @note This interface is intended to be included by {Device} if needed.
        module Raid
          RAID_INTERFACE = "org.opensuse.Agama.Storage1.RAID"
          private_constant :RAID_INTERFACE

          # Devices used by the DM RAID
          #
          # TODO: return object paths
          #
          # @return [Array<String>]
          def raid_devices
            storage_device.parents.map(&:name)
          end

          def self.included(base)
            base.class_eval do
              dbus_interface RAID_INTERFACE do
                dbus_reader :raid_devices, "as", dbus_name: "Devices"
              end
            end
          end
        end
      end
    end
  end
end
