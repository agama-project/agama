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
        # Section with the properties of MD RAID devices.
        class Md < Section
          # @see Section.apply?
          def self.apply?(storage_device)
            storage_device.is?(:md)
          end

        private

          # @see Section#conversions
          def conversions
            {
              uuid:    md_uuid,
              level:   md_level,
              devices: md_devices
            }
          end

          # UUID of the MD RAID
          #
          # @return [String, nil]
          def md_uuid
            storage_device.uuid
          end

          # RAID level
          #
          # @return [String]
          def md_level
            storage_device.md_level.to_s
          end

          # SIDs of the objects representing the devices of the MD RAID.
          #
          # @return [Array<Integer>]
          def md_devices
            storage_device.plain_devices.map(&:sid)
          end
        end
      end
    end
  end
end
