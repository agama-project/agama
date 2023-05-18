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
        # Interface for MD RAID devices
        #
        # @note This interface is intended to be included by {Device} if needed.
        module Md
          MD_INTERFACE = "org.opensuse.Agama.Storage1.MD"
          private_constant :MD_INTERFACE

          # UUID of the MD RAID
          #
          # @return [String]
          def md_uuid
            storage_device.uuid
          end

          # RAID level
          #
          # @return [String]
          def md_level
            storage_device.md_level.to_s
          end

          # Member devices of the MD RAID
          #
          # TODO: return object paths once all possible members (e.g., partitions) are exported
          #   on D-Bus.
          #
          # @return [Array<String>]
          def md_members
            storage_device.plain_devices.map(&:name)
          end

          def self.included(base)
            base.class_eval do
              dbus_interface MD_INTERFACE  do
                dbus_reader :md_uuid, "s", dbus_name: "UUID"
                dbus_reader :md_level, "s", dbus_name: "Level"
                dbus_reader :md_members, "as", dbus_name: "Members"
              end
            end
          end
        end
      end
    end
  end
end
