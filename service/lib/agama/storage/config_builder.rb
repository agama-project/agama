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

require "agama/storage/configs"
require "agama/storage/proposal_settings_reader"
require "agama/storage/volume_templates_builder"
require "pathname"
require "y2storage/disk_size"
require "y2storage/storage_manager"

module Agama
  module Storage
    # Class for building configs.
    class ConfigBuilder
      # @todo Replace product_config param by a ProductDefinition.
      #
      # @param product_config [Agama::Config]
      def initialize(product_config)
        @product_config = product_config
      end

      # Default encryption config from the product definition.
      #
      # @return [Configs::Encryption]
      def default_encryption
        Configs::Encryption.new.tap do |config|
          config.password = settings.encryption.password
          config.method = settings.encryption.method
          config.pbkd_function = settings.encryption.pbkd_function
        end
      end

      # Default format config from the product definition.
      #
      # @param path [String, nil]
      # @return [Configs::Filesystem]
      def default_filesystem(path = nil)
        Configs::Filesystem.new.tap do |config|
          config.type = default_fstype(path)
        end
      end

      # Default size config from the product definition.
      #
      # The size defined by the product depends on the mount path of the device. That size can be
      # increased because some reasons:
      #   * Fallback sizes: the size of other path is added to the volume. For example, if /home is
      #     not present, then the root volume increases its min and max limits by adding the min and
      #     max limits from the missing /home. The having_paths parameter is used to indicate what
      #     paths are present. The product defines the fallback paths.
      #   * Snapshots size: a device can be configured to use snapshots. The default size limits
      #     could be increased if snapshots are used. The with_snapshots parameter indicates whether
      #     to add the snapshots size. The product defines the snapshots size.
      #   * RAM size: the product defines whether the volume for a specific path should be as big as
      #     the RAM size.
      #
      # @param path [String, nil] Mount path of the device.
      # @param having_paths [Array<String>] Paths where other devices are mounted.
      # @param with_snapshots [Boolean] Whether to add the Btrfs snapshots size.
      # @return [Configs::Size]
      def default_size(path = nil, having_paths: [], with_snapshots: true)
        volume = volume_builder.for(path || "")

        return unlimited_size unless volume

        return auto_size(volume.outline, having_paths, with_snapshots) if volume.auto_size?

        Configs::Size.new.tap do |config|
          config.min = volume.min_size
          config.max = volume.max_size
        end
      end

    private

      # @return [Agama::Config]
      attr_reader :product_config

      # Default filesystem type config from the product definition.
      #
      # @param path [String, nil]
      # @return [Configs::FilesystemType]
      def default_fstype(path = nil)
        volume = volume_builder.for(path || "")

        Configs::FilesystemType.new.tap do |config|
          config.fs_type = volume.fs_type
          config.btrfs = volume.btrfs
        end
      end

      # @return [Configs::Size]
      def unlimited_size
        Configs::Size.new.tap do |config|
          config.min = Y2Storage::DiskSize.zero
          config.max = Y2Storage::DiskSize.unlimited
        end
      end

      # @see #default_size
      #
      # @param outline [VolumeOutline]
      # @param paths [Array<String>]
      # @param snapshots [Boolean]
      #
      # @return [Configs::Size]
      def auto_size(outline, paths, snapshots)
        min_fallbacks = remove_paths(outline.min_size_fallback_for, paths)
        min_size_fallbacks = min_fallbacks.map { |p| volume_builder.for(p).min_size }
        min = min_size_fallbacks.reduce(outline.base_min_size, &:+)

        max_fallbacks = remove_paths(outline.max_size_fallback_for, paths)
        max_size_fallbacks = max_fallbacks.map { |p| volume_builder.for(p).max_size }
        max = max_size_fallbacks.reduce(outline.base_max_size, &:+)

        if outline.adjust_by_ram?
          min = size_with_ram(min)
          max = size_with_ram(max)
        end

        if snapshots
          min = size_with_snapshots(min, outline)
          max = size_with_snapshots(max, outline)
        end

        Configs::Size.new.tap do |config|
          config.min = min
          config.max = max
        end
      end

      # @see #default_size
      #
      # @param size [Y2Storage::DiskSize]
      # @return [Y2Storage::DiskSize]
      def size_with_ram(size)
        [size, ram_size].max
      end

      # @see #default_size
      #
      # @param size [Y2Storage::DiskSize]
      # @param outline [VolumeOutline]
      #
      # @return [Y2Storage::DiskSize]
      def size_with_snapshots(size, outline)
        return size unless outline.snapshots_affect_sizes?

        if outline.snapshots_size && outline.snapshots_size > Y2Storage::DiskSize.zero
          size + outline.snapshots_size
        else
          multiplicator = 1.0 + (outline.snapshots_percentage / 100.0)
          size * multiplicator
        end
      end

      # @param paths [Array<String>]
      # @param paths_to_remove [Array<String>]
      #
      # @return [Array<String>]
      def remove_paths(paths, paths_to_remove)
        paths.reject do |path|
          paths_to_remove.any? { |p| Pathname.new(p).cleanpath == Pathname.new(path).cleanpath }
        end
      end

      # Total amount of RAM.
      #
      # @return [DiskSize]
      def ram_size
        @ram_size ||= Y2Storage::DiskSize.new(Y2Storage::StorageManager.instance.arch.ram_size)
      end

      # @return [ProposalSettings]
      def settings
        @settings ||= ProposalSettingsReader.new(product_config).read
      end

      # @return [VolumeTemplatesBuilder]
      def volume_builder
        @volume_builder ||= VolumeTemplatesBuilder.new_from_config(product_config)
      end
    end
  end
end
