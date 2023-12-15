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
require "y2storage"
require "agama/storage/volume"
require "agama/storage/volume_outline"
require "agama/storage/btrfs_settings"

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

      # Generates all volumes from templates
      #
      # @return [Array<Agama::Storage::Volume>]
      def all
        @data.keys.map { |k| self.for(k) }
      end

      # Generates a default volume for the given path
      #
      # @param path [String]
      # @return [Agama::Storage::Volume]
      def for(path)
        data = @data[path_key(path)] || @data[""] || empty_data

        Volume.new(path).tap do |volume|
          volume.btrfs = data[:btrfs]
          volume.outline = data[:outline]
          volume.fs_type = data[:filesystem]
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

      def fetch(hash, key, default = nil)
        key_s = key.to_s
        return hash[key_s] if hash.key?(key_s)

        hash.fetch(key.to_sym, default)
      end

      def key(data)
        path = fetch(data, :mount_path, "")
        path_key(path)
      end

      def path_key(path)
        return "" if path.empty?

        cleanpath(path)
      end

      # Temporary method to avoid crashes if there is no default template
      def empty_data
        {
          btrfs:         BtrfsSettings.new,
          outline:       VolumeOutline.new,
          mount_options: [],
          filesystem:    Y2Storage::Filesystems::Type::EXT4
        }
      end

      def values(data)
        {}.tap do |values|
          values[:btrfs] = btrfs(data)
          values[:outline] = outline(data)
          values[:mount_options] = fetch(data, :mount_options, [])

          # TODO: maybe ensure consistency of values[:filesystem] and values[:outline].filesystems ?
          fs = fetch(data, :filesystem)
          values[:filesystem] = fs_type(fs) if fs
          values[:filesystem] ||= values[:outline].filesystems.first
          values[:filesystem] ||= Y2Storage::Filesystems::Type::EXT4

          size = fetch(data, :size, {})
          values[:auto_size] = fetch(size, :auto, false)
          values[:min_size] = parse_disksize(fetch(size, :min))
          values[:max_size] = parse_disksize(fetch(size, :max))
        end
      end

      def btrfs(data)
        btrfs_data = fetch(data, "btrfs", {})
        BtrfsSettings.new.tap do |btrfs|
          btrfs.snapshots = fetch(btrfs_data, "snapshots", false)
          btrfs.read_only = fetch(btrfs_data, "read_only", false)
          btrfs.default_subvolume = fetch(btrfs_data, "default_subvolume", "")
          btrfs.subvolumes = fetch(btrfs_data, "subvolumes", []).map { |s| subvolume(s) }
        end
      end

      def subvolume(data)
        return Y2Storage::SubvolSpecification.new(data) if data.is_a?(String)

        archs = fetch(data, :archs, "").gsub(/\s+/, "").split(",")
        archs = nil if archs.none?

        attrs = { copy_on_write: fetch(data, :copy_on_write), archs: archs }.compact
        Y2Storage::SubvolSpecification.new(fetch(data, :path), **attrs)
      end

      def outline(data) # rubocop:disable Metrics/AbcSize
        outline_data = fetch(data, "outline", {})
        VolumeOutline.new.tap do |outline|
          outline.required = fetch(outline_data, "required", false)
          outline.filesystems = fetch(outline_data, "filesystems", [])
          outline.filesystems.map! { |fs| fs_type(fs) }
          outline.snapshots_configurable = fetch(outline_data, "snapshots_configurable", false)

          size = fetch(outline_data, "auto_size", {})
          min = parse_disksize(fetch(size, :base_min))
          max = parse_disksize(fetch(size, :base_max))
          outline.base_min_size = min if min
          outline.base_max_size = max if max
          outline.adjust_by_ram = fetch(size, :adjust_by_ram, false)
          outline.min_size_fallback_for = Array(fetch(size, :min_fallback_for))
          outline.min_size_fallback_for.map! { |p| cleanpath(p) }
          outline.max_size_fallback_for = Array(fetch(size, :max_fallback_for))
          outline.max_size_fallback_for.map! { |p| cleanpath(p) }

          assign_snapshots_increment(outline, fetch(size, :snapshots_increment))
        end
      end

      def assign_snapshots_increment(outline, increment)
        return if increment.nil?

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
        Pathname.new(path).cleanpath.to_s
      end

      def fs_type(filesystem)
        return filesystem if filesystem.is_a?(Y2Storage::Filesystems::Type)

        Y2Storage::Filesystems::Type.find(filesystem.downcase.to_sym)
      end
    end
  end
end
