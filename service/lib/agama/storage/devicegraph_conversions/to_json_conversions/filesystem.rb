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
require "y2storage/filesystem_label"

module Agama
  module Storage
    module DevicegraphConversions
      module ToJSONConversions
        # Section with properties for formatted devices.
        class Filesystem < Section
          # @see Section.apply?
          def self.apply?(storage_device)
            storage_device.is?(:blk_device) && !storage_device.filesystem.nil?
          end

        private

          # @see Section#conversions
          def conversions
            {
              sid:       filesystem_sid,
              type:      filesystem_type,
              mountPath: filesystem_mount_path,
              label:     filesystem_label
            }
          end

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
          # @return [String, nil] Nil if not mounted.
          def filesystem_mount_path
            storage_device.filesystem.mount_path
          end

          # Label of the file system.
          #
          # @return [String, nil] Nil if it has no label.
          def filesystem_label
            label = Y2Storage::FilesystemLabel.new(storage_device).to_s
            return if label.empty?

            label
          end
        end
      end
    end
  end
end
