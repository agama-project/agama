# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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
          # Interface for devices that contain a partition table.
          #
          # @note This interface is intended to be included by {Agama::DBus::Storage::Device} if
          #   needed.
          module PartitionTable
            # Whether this interface should be implemented for the given device.
            #
            # @note Devices containing a partition table implement this interface.
            #
            # @param storage_device [Y2Storage::Device]
            # @return [Boolean]
            def self.apply?(storage_device)
              storage_device.is?(:blk_device) &&
                storage_device.respond_to?(:partition_table?) &&
                storage_device.partition_table?
            end

            PARTITION_TABLE_INTERFACE = "org.opensuse.Agama.Storage1.PartitionTable"
            private_constant :PARTITION_TABLE_INTERFACE

            # Type of the partition table
            #
            # @return [String]
            def partition_table_type
              storage_device.partition_table.type.to_s
            end

            # Paths of the D-Bus objects representing the partitions.
            #
            # @return [Array<::DBus::ObjectPath>]
            def partition_table_partitions
              storage_device.partition_table.partitions.map { |p| tree.path_for(p) }
            end

            # Available slots within a partition table, that is, the spaces that can be used to
            # create a new partition.
            #
            # @return [Array<Array(Integer, Integer)>] The first block and the size of each slot.
            def partition_table_unused_slots
              storage_device.partition_table.unused_partition_slots.map do |slot|
                [slot.region.start, slot.region.size.to_i]
              end
            end

            def self.included(base)
              base.class_eval do
                dbus_interface PARTITION_TABLE_INTERFACE do
                  dbus_reader :partition_table_type, "s", dbus_name: "Type"
                  dbus_reader :partition_table_partitions, "ao", dbus_name: "Partitions"
                  dbus_reader :partition_table_unused_slots, "a(tt)", dbus_name: "UnusedSlots"
                end
              end
            end
          end
        end
      end
    end
  end
end
