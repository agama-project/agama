# Copyright (c) [2018] SUSE LLC
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

require "yast"
require "yast/i18n"

module Y2Storage
  # Class to represent storage setup error
  class SetupError
    include Yast::I18n

    # @return [VolumeSpecification]
    attr_reader :missing_volume

    # Constructor
    #
    # @param message [String, nil] error message
    # @param missing_volume [VolumeSpecification, nil] missing volume that causes the error
    def initialize(message: nil, missing_volume: nil)
      textdomain "storage"
      @message = message
      @missing_volume = missing_volume
    end

    # Error message
    #
    # @note If no message was indicated, it can be generated from the missing volume.
    #
    # @return [String, nil]
    def message
      message = @message
      message ||= message_for_missing_volume if missing_volume
      message
    end

    private

    # Error text for the missing volume
    #
    # @return [String]
    def message_for_missing_volume
      if mount_point_info
        message_with_mount_point
      else
        message_without_mount_point
      end
    end

    # Error text when the missing volume has mount point
    #
    # @return [String]
    def message_with_mount_point
      if partition_id_info && fs_types_info
        message_with_mount_point_and_partition_id_and_fs
      elsif partition_id_info
        message_with_mount_point_and_partition_id
      elsif fs_types_info
        message_with_mount_point_and_fs
      else
        message_with_mount_point_default
      end
    end

    # Error text when the missing volume does not have mount point
    #
    # @return [String]
    def message_without_mount_point
      if partition_id_info && fs_types_info
        message_with_partition_id_and_fs
      elsif partition_id_info
        message_with_partition_id
      elsif fs_types_info
        message_with_fs
      else
        message_without_mount_point_default
      end
    end

    # @return [String]
    def message_with_mount_point_and_partition_id_and_fs
      # TRANSLATORS: error message, where %{mount_point} is replaced by a mount point
      # (e.g., /lib/docker), %{size} by a disk size (e.g., 5 GiB), %{partition_id} by a
      # partition id (e.g., Linux) and %{fs_types} by a list of filesystem types separated
      # by comma (e.g., ext2, ext3, ext4).
      format(
        "Missing device for %{mount_point} with size equal or bigger than %{size}, " \
        "partition id %{partition_id} and filesystem %{fs_types}",
        mount_point:  mount_point_info,
        size:         size_info,
        partition_id: partition_id_info,
        fs_types:     fs_types_info
      )
    end

    # @return [String]
    def message_with_mount_point_and_partition_id
      # TRANSLATORS: error message, where %{mount_point} is replaced by a mount point
      # (e.g., /lib/docker), %{size} by a disk size (e.g., 5 GiB) and %{partition_id}.
      format(
        "Missing device for %{mount_point} with size equal or bigger than %{size} " \
        "and partition id %{partition_id}",
        mount_point:  mount_point_info,
        size:         size_info,
        partition_id: partition_id_info
      )
    end

    # @return [String]
    def message_with_mount_point_and_fs
      # TRANSLATORS: error message, where %{mount_point} is replaced by a mount point
      # (e.g., /lib/docker), %{size} by a disk size (e.g., 5 GiB) and %{fs_types} by a
      # list of filesystem types separated by comma (e.g., ext2, ext3, ext4).
      format(
        "Missing device for %{mount_point} with size equal or bigger than %{size} " \
        "and filesystem %{fs_types}",
        mount_point: mount_point_info,
        size:        size_info,
        fs_types:    fs_types_info
      )
    end

    # @return [String]
    def message_with_mount_point_default
      # TRANSLATORS: error message, where %{mount_point} is replaced by a mount point
      # (e.g., /lib/docker) and %{size} by a disk size (e.g., 5 GiB).
      format(
        "Missing device for %{mount_point} with size equal or bigger than %{size} ",
        mount_point: mount_point_info,
        size:        size_info
      )
    end

    # @return [String]
    def message_with_partition_id_and_fs
      # TRANSLATORS: error message, where %{size} is replaced by a disk size (e.g., 5 GiB),
      # %{partition_id} by a partition id (e.g., Linux) and %{fs_types} by a list of filesystem
      # types separated by comma (e.g., ext2, ext3, ext4).
      format(
        "Missing device with size equal or bigger than %{size}, " \
        "partition id %{partition_id} and filesystem %{fs_types}",
        size:         size_info,
        partition_id: partition_id_info,
        fs_types:     fs_types_info
      )
    end

    # @return [String]
    def message_with_partition_id
      # TRANSLATORS: error message, where %{size} is replaced by a disk size (e.g., 5 GiB) and
      # %{partition_id} by a partition id (e.g., Linux).
      format(
        "Missing device with size equal or bigger than %{size} " \
        "and partition id %{partition_id}",
        size:         size_info,
        partition_id: partition_id_info
      )
    end

    # @return [String]
    def message_with_fs
      # TRANSLATORS: error message, where %{size} is replaced by a disk size (e.g., 5 GiB) and
      # %{fs_types} by a list of filesystem types separated by comma (e.g., ext2, ext3, ext4).
      format(
        "Missing device with size equal or bigger than %{size} " \
        "and filesystem %{fs_types}",
        size:     size_info,
        fs_types: fs_types_info
      )
    end

    # @return [String]
    def message_without_mount_point_default
      # TRANSLATORS: error message, where %{size} is replaced by a disk size (e.g., 5 GiB).
      format(
        "Missing device with size equal or bigger than %{size}",
        size: size_info
      )
    end

    # Volume mount point to show in the error message
    #
    # @return [String, nil]
    def mount_point_info
      missing_volume.mount_point
    end

    # Volume partition id to show in the error message
    #
    # @return [Integer, nil]
    def partition_id_info
      missing_volume.partition_id
    end

    # Possible volume fileystem types to show in the error message
    #
    # @return [String, nil]
    def fs_types_info
      return nil if missing_volume.fs_types.empty?

      missing_volume.fs_types.map(&:to_s).join(", ")
    end

    # Volume size to show in the error message
    #
    # @return [DiskSize, nil]
    def size_info
      missing_volume.min_size
    end
  end
end
