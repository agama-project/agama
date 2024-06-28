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

require "y2storage"
require "agama/storage/volume"

module Agama
  module Storage
    module VolumeConversions
      # Volume conversion to Y2Storage.
      class ToY2Storage
        # @param volume [Agama::Storage::Volume]
        def initialize(volume)
          @volume = volume
        end

        # Performs the conversion to Y2Storage.
        #
        # @return [Y2Storage::VolumeSpecification]
        def convert # rubocop:disable Metrics/AbcSize
          Y2Storage::VolumeSpecification.new({}).tap do |target|
            target.mount_point = volume.mount_path
            target.mount_options = volume.mount_options.join(",")
            target.proposed = true
            target.proposed_configurable = !volume.outline.required?
            target.fs_types = volume.outline.filesystems
            target.fs_type = volume.fs_type if volume.fs_type
            target.weight = 100
            target.adjust_by_ram = volume.outline.adjust_by_ram?

            sizes_conversion(target)
            btrfs_conversion(target)
            location_conversion(target)
          end
        end

      private

        # @return [Agama::Storage::Volume]
        attr_reader :volume

        # @param target [Y2Storage::VolumeSpecification]
        def sizes_conversion(target)
          auto = volume.auto_size?

          target.ignore_fallback_sizes = !auto
          target.ignore_snapshots_sizes = !auto
          target.ignore_adjust_by_ram = !auto

          # The range of sizes is defined by the volume outline in case of auto size (mix and max
          # sizes cannot be configured if auto size is set).
          # And note that the final range of sizes used by the Y2Storage proposal is calculated by
          # Y2Storage according the range configured here and other sizes like fallback sizes or
          # the size for snapshots.
          min_size = auto ? volume.outline.base_min_size : volume.min_size
          max_size = auto ? volume.outline.base_max_size : volume.max_size

          target.min_size = min_size
          target.max_size = max_size
          target.max_size_lvm = max_size
        end

        # @param target [Y2Storage::VolumeSpecification]
        def btrfs_conversion(target)
          target.snapshots = volume.btrfs.snapshots?
          target.snapshots_configurable = volume.outline.snapshots_configurable?
          target.snapshots_size = volume.outline.snapshots_size || Y2Storage::DiskSize.zero
          target.snapshots_percentage = volume.outline.snapshots_percentage || 0
          target.subvolumes = volume.btrfs.subvolumes
          target.btrfs_default_subvolume = volume.btrfs.default_subvolume
          target.btrfs_read_only = volume.btrfs.read_only?
        end

        # @param target [Y2Storage::VolumeSpecification]
        def location_conversion(target)
          location = volume.location
          return if location.default?

          if location.reuse_device?
            target.reuse_name = location.device
            target.reformat = location.target == :device
            return
          end

          target.device = location.device
          target.separate_vg_name = vg_name(target) if location.target == :new_vg
        end

        # Name to be used as separate_vg_name for the given Y2Storage volume
        #
        # @param target [Y2Storage::VolumeSpecification]
        def vg_name(target)
          mount_point = target.root? ? "root" : target.mount_point.sub(%r{^/}, "")
          "vg-#{mount_point.tr("/", "_")}"
        end
      end
    end
  end
end
