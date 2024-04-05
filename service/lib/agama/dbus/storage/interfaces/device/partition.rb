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
        module Device
          # Interface for partition.
          #
          # @note This interface is intended to be included by {Agama::DBus::Storage::Device} if
          #   needed.
          module Partition
            # Whether this interface should be implemented for the given device.
            #
            # @note Partitions implement this interface.
            #
            # @param storage_device [Y2Storage::Device]
            # @return [Boolean]
            def self.apply?(storage_device)
              storage_device.is?(:partition)
            end

            PARTITION_INTERFACE = "org.opensuse.Agama.Storage1.Partition"
            private_constant :PARTITION_INTERFACE

            # Device hosting the partition table of this partition.
            #
            # @return [Array<::DBus::ObjectPath>]
            def partition_device
              tree.path_for(storage_device.partitionable)
            end

            # Whether it is a (valid) EFI System partition
            #
            # @return [Boolean]
            def partition_efi
              storage_device.efi_system?
            end

            def self.included(base)
              base.class_eval do
                dbus_interface PARTITION_INTERFACE do
                  dbus_reader :partition_device, "o", dbus_name: "Device"
                  dbus_reader :partition_efi, "b", dbus_name: "EFI"
                end
              end
            end
          end
        end
      end
    end
  end
end
