# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require "agama/storage/devicegraph_conversions/to_json_conversions/interfaces"
require "y2storage/device_description"

module Agama
  module Storage
    module DevicegraphConversions
      module ToJSONConversions
        # Device conversion to JSON hash according to schema.
        class Device
          # @param storage_device [Y2Storage::Device]
          def initialize(storage_device)
            @storage_device= storage_device
          end

          def convert
            result = {
              sid:         device_sid,
              name:        device_name,
              description: device_description
            }
            add_interfaces(result)
            add_nested_devices(result)
            result
          end

        private

          attr_reader :storage_device

          # sid of the device.
          #
          # @return [Integer]
          def device_sid
            storage_device.sid
          end

          # Name to represent the device.
          #
          # @return [String] e.g., "/dev/sda".
          def device_name
            storage_device.display_name || ""
          end

          # Description of the device.
          #
          # @return [String] e.g., "EXT4 Partition".
          def device_description
            Y2Storage::DeviceDescription.new(storage_device, include_encryption: true).to_s
          end

          # Adds the required interfaces according to the storage object.
          def add_interfaces(hash)
            conversions = Interface.subclasses.select { |c| c.apply?(storage_device) }

            conversions.each do |conversion|
              hash.merge!(conversion.new(storage_device).convert)
            end
          end

          def add_nested_devices(hash)
            return unless PartitionTable.apply?(storage_device)
              
            hash[:partitions] = storage_device.partition_table.partitions.map do |part|
              self.class.new(part).convert
            end
          end
        end
      end
    end
  end
end
