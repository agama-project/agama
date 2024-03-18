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
require "y2storage/filesystem_label"

module Agama
  module DBus
    module Storage
      module Interfaces
        module Device
          # Interface for file systems.
          #
          # @note This interface is intended to be included by {Agama::DBus::Storage::Device} if
          #   needed.
          module Filesystem
            # Whether this interface should be implemented for the given device.
            #
            # @note Formatted devices implement this interface.
            #
            # @param storage_device [Y2Storage::Device]
            # @return [Boolean]
            def self.apply?(storage_device)
              storage_device.is?(:blk_device) && !storage_device.filesystem.nil?
            end

            FILESYSTEM_INTERFACE = "org.opensuse.Agama.Storage1.Filesystem"
            private_constant :FILESYSTEM_INTERFACE

            # SID of the file system.
            #
            # It is useful to detect whether a file system is new.
            #
            # @return [Integer]
            def filesystem_sid
              storage_device.filesystem.sid
            end

            # File system type.
            #
            # @return [String] e.g., "ext4"
            def filesystem_type
              storage_device.filesystem.type.to_s
            end

            # Mount path of the file system.
            #
            # @return [String] Empty if not mounted.
            def filesystem_mount_path
              storage_device.filesystem.mount_path || ""
            end

            # Label of the file system.
            #
            # @return [String] Empty if it has no label.
            def filesystem_label
              Y2Storage::FilesystemLabel.new(storage_device).to_s
            end

            def self.included(base)
              base.class_eval do
                dbus_interface FILESYSTEM_INTERFACE do
                  dbus_reader :filesystem_sid, "u", dbus_name: "SID"
                  dbus_reader :filesystem_type, "s", dbus_name: "Type"
                  dbus_reader :filesystem_mount_path, "s", dbus_name: "MountPath"
                  dbus_reader :filesystem_label, "s", dbus_name: "Label"
                end
              end
            end
          end
        end
      end
    end
  end
end
