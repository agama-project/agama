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

module Agama
  module Storage
    # Settings used to calculate an storage proposal.
    class Config
      # Boot settings.
      #
      # @return [Configs::Boot]
      attr_accessor :boot

      attr_accessor :drives
      attr_accessor :volume_groups
      attr_accessor :md_raids
      attr_accessor :btrfs_raids
      attr_accessor :nfs_mounts
      attr_accessor :original_graph

      def initialize
        @boot = Configs::Boot.new
        @drives = []
        @volume_groups = []
        @md_raids = []
        @btrfs_raids = []
        @nfs_mounts = []
      end

      # Creates a config from JSON hash according to schema.
      #
      # @param config_json [Hash]
      # @param product_config [Agama::Config]
      #
      # @return [Storage::Config]
      def self.new_from_json(config_json, product_config:)
        ConfigConversions::FromJSON.new(config_json, product_config: product_config).convert
      end

      def boot_device
        explicit_boot_device || implicit_boot_device
      end

      # Device used for booting.
      #
      # @return [String, nil]
      def explicit_boot_device
        return nil unless boot.configure?

        boot.device
      end

      def implicit_boot_device
        # TODO: preliminary implementation with very simplistic checks
        root_drive = drives.find do |drive|
          drive.partitions.any? { |p| p.mount&.path == "/" }
        end

        root_drive&.found_device.name
      end

      def calculate_default_sizes(volume_builder)
        default_size_devices.each do |dev|
          dev.size.min = default_size(dev, :min, volume_builder)
          dev.size.max = default_size(dev, :max, volume_builder)
        end
      end

      private

      def filesystems
        (drives + partitions).map(&:filesystem).compact
      end

      def partitions
        drives.flat_map(&:partitions)
      end

      def default_size_devices
        partitions.select { |p| p.size&.default? }
      end

      def default_size(device, attr, builder)
        # TODO: what to do if path is nil or empty?
        path = device.filesystem&.path
        # TODO: what to do if there is no default volume?
        vol = builder.for(path)

        return vol.send(:"#{attr}_size") unless vol.auto_size?

        outline = vol.outline
        size = size_with_fallbacks(device, outline, attr, builder)
        size = size_with_ram(size, outline)
        size_with_snapshots(size, device, outline)
      end

      def size_with_fallbacks(device, outline, attr, builder)
        proposed_paths = filesystems.map(&:path)

        size = outline.send(:"base_#{attr}_size")

        fallback_paths = outline.send(:"#{attr}_size_fallback_for")
        # TODO: we need to normalize all the paths (or use Path for comparison or whatever)
        missing_paths = fallback_paths - proposed_paths
        missing_paths.inject(size) { |total, p| total + builder.for(p).send(:"#{attr}_size") }
      end

      def size_with_ram(initial_size, outline)
        return initial_size unless outline.adjust_by_ram?

        [initial_size, ram_size].max
      end

      def size_with_snapshots(initial_size, device, outline)
        return initial_size unless device.filesystem.btrfs_snapshots?
        return initial_size unless outline.snapshots_affect_sizes?

        if outline.snapshots_size && outline.snapshots_size > DiskSize.zero
          initial_size + outline.snapshots_size
        else
          multiplicator = 1.0 + (outline.snapshots_percentage / 100.0)
          initial_size * multiplicator
        end
      end

      # Return the total amount of RAM as DiskSize
      #
      # @return [DiskSize] current RAM size
      def ram_size
        @ram_size ||= Y2Storage::DiskSize.new(Y2Storage::StorageManager.instance.arch.ram_size)
      end
    end
  end
end
