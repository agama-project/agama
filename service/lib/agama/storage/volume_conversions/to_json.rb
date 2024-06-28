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

require "agama/storage/volume"
require "agama/storage/volume_location"
require "y2storage"

module Agama
  module Storage
    module VolumeConversions
      # Volume conversion to JSON hash according to schema.
      class ToJSON
        # @param volume [Volume]
        def initialize(volume)
          @volume = volume
        end

        # Performs the conversion to JSON.
        #
        # @return [Hash]
        def convert
          {
            mount:  mount_conversion,
            size:   size_conversion,
            target: target_conversion
          }.tap do |volume_json|
            filesystem_json = filesystem_conversion
            volume_json[:filesystem] = filesystem_json if filesystem_json
          end
        end

      private

        # @return [Volume]
        attr_reader :volume

        def mount_conversion
          {
            path:    volume.mount_path.to_s,
            options: volume.mount_options
          }
        end

        def filesystem_conversion
          return unless volume.fs_type
          return volume.fs_type.to_s if volume.fs_type != Y2Storage::Filesystems::Type::BTRFS

          {
            btrfs: {
              snapshots: volume.btrfs.snapshots?
            }
          }
        end

        def size_conversion
          return "auto" if volume.auto_size?

          size = { min: volume.min_size.to_i }
          size[:max] = volume.max_size.to_i if volume.max_size != Y2Storage::DiskSize.unlimited
          size
        end

        def target_conversion
          location = volume.location

          case location.target
          when :default
            "default"
          when :new_partition
            { newPartition: location.device }
          when :new_vg
            { newVg: location.device }
          when :device
            { device: location.device }
          when :filesystem
            { filesystem: location.device }
          end
        end
      end
    end
  end
end
