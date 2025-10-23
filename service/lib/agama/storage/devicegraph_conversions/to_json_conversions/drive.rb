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

require "agama/storage/devicegraph_conversions/to_json_conversions/section"

module Agama
  module Storage
    module DevicegraphConversions
      module ToJSONConversions
        # Section with properties for drive devices.
        class Drive < Section
          # Whether this section should be exported for the given device.
          #
          # Drive and disk device are very close concepts, but there are subtle differences. For
          # example, a MD RAID is never considered as a drive.
          #
          # TODO: Revisit the defintion of drive. Maybe some MD devices could implement the drive
          #   interface if hwinfo provides useful information for them.
          #
          # @param storage_device [Y2Storage::Device]
          # @return [Boolean]
          def self.apply?(storage_device)
            storage_device.is?(:disk, :dm_raid, :multipath, :dasd) &&
              storage_device.is?(:disk_device)
          end

        private

          # @see Section#conversions
          def conversions
            {
              type:      drive_type,
              vendor:    drive_vendor,
              model:     drive_model,
              bus:       drive_bus,
              busId:     drive_bus_id,
              driver:    drive_driver,
              transport: drive_transport,
              info:      drive_info
            }
          end

          # Drive type
          #
          # @return ["disk", "raid", "multipath", "dasd", nil] Nil if type is unknown.
          def drive_type
            if storage_device.is?(:disk)
              "disk"
            elsif storage_device.is?(:dm_raid)
              "raid"
            elsif storage_device.is?(:multipath)
              "multipath"
            elsif storage_device.is?(:dasd)
              "dasd"
            end
          end

          # Vendor name
          #
          # @return [String, nil]
          def drive_vendor
            storage_device.vendor
          end

          # Model name
          #
          # @return [String, nil]
          def drive_model
            storage_device.model
          end

          # Bus name
          #
          # @return [String, nil]
          def drive_bus
            # FIXME: not sure whether checking for "none" is robust enough
            return if storage_device.bus.nil? || storage_device.bus.casecmp?("none")

            storage_device.bus
          end

          # Bus Id for DASD
          #
          # @return [String, nil]
          def drive_bus_id
            return unless storage_device.respond_to?(:bus_id)

            storage_device.bus_id
          end

          # Kernel drivers used by the device
          #
          # @return [Array<String>]
          def drive_driver
            storage_device.driver
          end

          # Data transport layer, if any
          #
          # @return [String, nil]
          def drive_transport
            return unless storage_device.respond_to?(:transport)

            transport = storage_device.transport
            return if transport.nil? || transport.is?(:unknown)

            # FIXME: transport does not have proper i18n support at yast2-storage-ng, so we are
            # just duplicating some logic from yast2-storage-ng here
            return "USB" if transport.is?(:usb)
            return "IEEE 1394" if transport.is?(:sbp)

            transport.to_s
          end

          # More info about the device
          #
          # @return [Hash]
          def drive_info
            {
              sdCard:   storage_device.sd_card?,
              dellBoss: storage_device.boss?
            }
          end
        end
      end
    end
  end
end
