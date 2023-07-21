# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
    module VolumeConversion
      # Utility class offering methods to convert between Y2Storage::VolumeSpecification objects and
      # Agama::Volume ones
      # Internal class to generate a Y2Storage volume specification
      class ToY2Storage
        # Constructor
        #
        # @param volume see {#volume}
        # @param default_specs see #{default_specs}
        def initialize(volume)
          @volume = volume
        end

        # @see VolumeConverter#to_y2storage
        def convert
          spec = Y2Storage::VolumeSpecification.new({})

          spec.device = volume.device
          spec.separate_vg_name = volume.separate_vg_name
          spec.mount_point = volume.mount_path
          spec.mount_options = volume.mount_options
          spec.proposed = true
          spec.proposed_configurable = !volume.outline.required?
          spec.fs_types = volume.outline.filesystems
          spec.fs_type = volume.fs_type
          spec.weight = 100
          spec.adjust_by_ram = volume.outline.adjust_by_ram?

          sizes_conversion(spec)
          btrfs_conversion(spec)
        end

      private

        # @see VolumeConverter#to_y2storage
        attr_reader :volume

        # Configures size related attributes
        #
        # @param spec [Y2Storage::VolumeSpecification] The spec is modified
        def sizes_conversion(spec)
          auto = volume.auto_size?

          spec.ignore_fallback_sizes = !auto
          spec.ignore_snapshots_sizes = !auto

          spec.min_size = auto ? volume.outline.base_min_size : volume.min_size
          spec.max_size = auto ? volume.outline.base_max_size : volume.max_size
        end

        def btrfs_conversion(spec)
          subvolumes = volume.btrfs.subvolumes.map { |v| Y2Storage::SubvolSpecification.new(v) }

          spec.snapshots = volume.btrfs.snapshots?
          spec.snapshots_configurable = volume.outline.snapshots_configurable?
          spec.snapshots_size = volume.outline.snapshots_size
          spec.snapshots_percentage = volume.outline.snapshots_percentage
          spec.subvolumes = subvolumes
          spec.btrfs_default_subvolume = volume.btrfs.default_subvolume
          spec.btrfs_read_only = volume.btrfs.read_only?
        end
      end
    end
  end
end
