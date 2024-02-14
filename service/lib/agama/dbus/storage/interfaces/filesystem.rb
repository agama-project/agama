# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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
        # Interface for file systems.
        #
        # @note This interface is intended to be included by {Device} if needed.
        module Filesystem
          FILESYSTEM_INTERFACE = "org.opensuse.Agama.Storage1.Filesystem"
          private_constant :FILESYSTEM_INTERFACE

          # File system type.
          #
          # @return [String] e.g., "ext4"
          def filesystem_type
            storage_device.filesystem.type.to_s
          end

          # Whether the file system contains an EFI.
          #
          # @return [Boolean]
          def filesystem_efi?
            storage_device.filesystem.efi?
          end

          def self.included(base)
            base.class_eval do
              dbus_interface FILESYSTEM_INTERFACE  do
                dbus_reader :filesystem_type, "s", dbus_name: "Type"
                dbus_reader :filesystem_efi?, "b", dbus_name: "EFI"
              end
            end
          end
        end
      end
    end
  end
end
