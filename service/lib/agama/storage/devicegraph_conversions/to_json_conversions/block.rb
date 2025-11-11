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
require "agama/storage/device_shrinking"

module Agama
  module Storage
    module DevicegraphConversions
      module ToJSONConversions
        # Section with properties for block devices.
        class Block < Section
          # @see Section.apply?
          def self.apply?(storage_device)
            storage_device.is?(:blk_device)
          end

        private

          # @see Section#conversions
          def conversions
            {
              start:     block_start,
              active:    block_active,
              encrypted: block_encrypted,
              udevIds:   block_udev_ids,
              udevPaths: block_udev_paths,
              size:      block_size,
              shrinking: block_shrinking,
              systems:   block_systems
            }
          end

          # Position of the first block of the region.
          #
          # @return [Integer]
          def block_start
            storage_device.start
          end

          # Whether the block device is currently active
          #
          # @return [Boolean]
          def block_active
            storage_device.active?
          end

          # Whether the block device is encrypted.
          #
          # @return [Boolean]
          def block_encrypted
            storage_device.encrypted?
          end

          # Name of the udev by-id links
          #
          # @return [Array<String>]
          def block_udev_ids
            storage_device.udev_ids
          end

          # Name of the udev by-path links
          #
          # @return [Array<String>]
          def block_udev_paths
            storage_device.udev_paths
          end

          # Size of the block device in bytes
          #
          # @return [Integer]
          def block_size
            storage_device.size.to_i
          end

          # Shrinking information.
          #
          # @return [Hash]
          def block_shrinking
            shrinking = Agama::Storage::DeviceShrinking.new(storage_device)

            if shrinking.supported?
              {
                supported: true,
                minSize:   shrinking.min_size.to_i
              }
            else
              {
                supported: false,
                reasons:   shrinking.unsupported_reasons
              }
            end
          end

          # Name of the currently installed systems
          #
          # @return [Array<String>]
          def block_systems
            return @systems if @systems

            filesystems = storage_device.descendants.select { |d| d.is?(:filesystem) }
            @systems = filesystems.map(&:system_name).compact
          end
        end
      end
    end
  end
end
