# Copyright (c) [2017] SUSE LLC
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

module Y2Storage
  # Mixin to match with a volume specification
  module MatchVolumeSpec
    # Whether matches with the given volume specification
    #
    # @note Matching is performed by mount point, size, filesystem type and partition id.
    #   The exclude param can be used to avoid some of those matches.
    #
    # @param volume [VolumeSpecification]
    # @param exclude [Array<Symbol>, Symbol] :mount_point, :size, :fs_type, :partition_id
    #
    # @return [Boolean] whether matches the volume; false otherwise.
    def match_volume?(volume, exclude: [])
      exclude = [exclude].flatten

      match = true
      match &&= match_mount_point?(volume) unless exclude.include?(:mount_point)
      match &&= match_size?(volume) unless exclude.include?(:size)
      match &&= match_fs_type?(volume) unless exclude.include?(:fs_type)
      match &&= match_partition_id?(volume) unless exclude.include?(:partition_id)
      match
    end

    protected

    # This can be redefined with the values to take into account during matching
    #
    # @note Only symbols :mount_point, :size, :fs_type and :partition_id are used
    #   for matching.
    #
    # @example
    #   def volume_match_values
    #     { size: device.min_size, partition_id: id, fs_type: filesystem.type }
    #   end
    #
    # @return [Hash]
    def volume_match_values
      {}
    end

    # Whether the mount point value matches the volume mount point
    #
    # @param volume [VolumeSpecification]
    # @return [Boolean]
    def match_mount_point?(volume)
      volume_match_values[:mount_point] == volume.mount_point
    end

    # Whether the size value matches the volume min size
    #
    # @note The size matches when the give size value is equal or bigger
    #   than the volume min size. It always returns false if a size value
    #   is not given.
    #
    # @param volume [VolumeSpecification]
    # @return [Boolean]
    def match_size?(volume)
      return false if volume_match_values[:size].nil?

      volume_match_values[:size].between?(volume.min_size, volume.max_size_limit)
    end

    # Whether the fileystem type matches the volume filesystem type
    #
    # @note This is always considered as true when the volume specification does not
    #   have any filesystem type.
    #
    # @param volume [VolumeSpecification]
    # @return [Boolean]
    def match_fs_type?(volume)
      return true if volume.fs_types.empty?

      volume.fs_types.include?(volume_match_values[:fs_type])
    end

    # Whether the partition id matches the volume partition id
    #
    # @note This is always considered as true when the volume specification does not
    #   have any partition id.
    #
    # @param volume [VolumeSpecification]
    # @return [Boolean]
    def match_partition_id?(volume)
      return true if volume.partition_id.nil?

      volume_match_values[:partition_id] == volume.partition_id
    end
  end
end
