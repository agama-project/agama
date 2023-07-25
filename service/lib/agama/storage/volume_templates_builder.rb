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

require "pathname"
require "yast"
require "y2storage"

module Agama
  module Storage
    # Class for creating a volume from the volume templates information provided by the config
    # file.
    class VolumeTemplatesBuilder
      # Creates a new instance from a config file
      #
      # @param config [Agama::Config]
      # @return [VolumeTemplateBuilder]
      def self.new_from_config(config)
        volume_templates = config.data.fetch("storage", {}).fetch("volume_templates", [])
        new(volume_templates)
      end

      # @param config_data [Hash] Value of volume_templates key from a config file
      def initialize(config_data)
        @data = {}

        # TODO: maybe add an entry for "" if no default is provided?
        config_data.each do |volume_data|
          @data[key(volume_data)] = values(volume_data)
        end
      end

      # Generates a default volume for the given path
      #
      # @param path [String]
      # @return [Agama::Storage::Volume]
      def for(path)
        data = @data[cleanpath(path)] || @data[""]

        Volume.new(path).tap do |volume|
          volume.btrfs = data[:btrfs]
          volume.outline = data[:outline]
          volume.filesystem = data[:filesystem]
          volume.mount_options = data[:mount_options]

          if data[:auto_size] && volume.auto_size_supported?
            volume.auto_size = true
          else
            volume.auto_size = false
            volume.min_size = data[:min_size] if data[:min_size]
            volume.max_size = data[:max_size] if data[:max_size]
          end
        end
      end

    private

      def key(data)
        path = data["mount_path"]
        return "" unless path

        cleanpath(path)
      end

      def values(data) # rubocop:disable Metrics/AbcSize
        {}.tap do |values|
          values[:btrfs] = btrfs(data)
          values[:outline] = outline(data)
          values[:mount_options] = data.fetch("mount_options", [])

          # TODO: maybe ensure consistency of values[:filesystem] and values[:outline].filesystems ?
          fs = data["filesystem"]
          values[:filesystem] = Y2Storage::Filesystems::Type.find(fs.downcase.to_sym) if fs
          values[:filesystem] ||= values[:outline].filesystems.first
          values[:filesystem] ||= Y2Storage::Filesystems::Type::EXT4

          size = outline_data.fetch("size", {})
          values[:auto_size] = size.fetch("auto", false)
          values[:min_size] = parse_disksize(size["min"])
          values[:max_size] = parse_disksize(size["max"])
        end
      end

      def btrfs(data)
        btrfs_data = data.fetch("btrfs", {})
        BtrfsSettings.new.tap do |btrfs|
          btrfs.snapshots = btrfs_data.fetch("snapshots", false)
          btrfs.read_only = btrfs_data.fetch("read_only", false)
          btrfs.default_subvolume = btrfs_data.fetch("default_subvolume", "")
          btrfs.subvolumes = btrfs_data["subvolumes"]
          btrfs.subvolumes&.map! { |subvol_data| subvolume(subvol_data) }
        end
      end

      def subvolume(data)
        return Y2Storage::SubvolSpecification.new(data) if data.is_a?(String)

        Y2Storage::SubvolSpecification.new(
          data["path"], copy_on_write: data["copy_on_write"], archs: data["archs"]
        )
      end

      def outline(data) # rubocop:disable Metrics/AbcSize
        outline_data = data.fetch("outline", {})
        VolumeOutline.new.tap do |outline|
          outline.required = outline_data.fetch("required", false)
          outline.filesystems = outline_data.fetch("filesystems", [])
          outline.filesystems.map! { |fs| Y2Storage::Filesystems::Type.find(fs.downcase.to_sym) }
          outline.snapshots_configurable = outline_data.fetch("snapshots_configurable", true)

          size = outline_data.fetch("auto_size", {})
          min = parse_disksize(size["min"])
          max = parse_disksize(size["max"])
          outline.base_min_size = min if min
          outline.base_max_size = max if max
          outline.adjust_by_ram = size.fetch("adjust_by_ram", false)
          outline.min_size_fallback_for = Array(size["min_fallback_for"])
          outline.min_size_fallback_for.map! { |p| cleanpath(p) }
          outline.max_size_fallback_for = Array(size["max_fallback_for"])
          outline.max_size_fallback_for.map! { |p| cleanpath(p) }

          assign_snapshots_increment(outline, size["snapshots_increment"])
        end
      end

      def assign_snapshots_increment(outline, increment)
        return if increment.nil

        if increment =~ /(\d+)\s*%/
          outline.snapshots_percentage = Regexp.last_match(1).to_i
        else
          outline.snapshots_size = Y2Storage::DiskSize.parse(increment, legacy_units: true)
        end
      end

      def parse_disksize(value)
        return nil unless value

        Y2Storage::DiskSize.parse_or(value, nil, legacy_units: true)
      end

      def cleanpath(path)
        Pathname.new(path).cleanpath
      end
    end
  end
end
