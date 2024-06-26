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
require "agama/storage/volume_templates_builder"
require "y2storage"

module Agama
  module Storage
    module VolumeConversion
      # Volume conversion from Hash according to the JSON schema.
      class FromSchema
        # @param volume_schema [Hash]
        # @param config [Config]
        def initialize(volume_schema, config:)
          # @todo Raise error if volume_schema does not match the JSON schema.
          @volume_schema = volume_schema
          @config = config
        end

        # Performs the conversion from Hash according to the JSON schema.
        #
        # @return [Volume]
        def convert
          default_volume.tap do |volume|
            mount_conversion(volume)
            filesystem_conversion(volume)
            size_conversion(volume)
            target_conversion(volume)
          end
        end

      private

        # @return [Hash]
        attr_reader :volume_schema

        # @return [Agama::Config]
        attr_reader :config

        # @param volume [Volume]
        def mount_conversion(volume)
          path_value = volume_schema.dig(:mount, :path)
          options_value = volume_schema.dig(:mount, :options)

          volume.mount_path = path_value
          volume.mount_options = options_value if options_value
        end

        # @param volume [Volume]
        def filesystem_conversion(volume)
          filesystem_schema = volume_schema[:filesystem]
          return unless filesystem_schema

          if filesystem_schema.is_a?(String)
            filesystem_string_conversion(volume, filesystem_schema)
          else
            filesystem_hash_conversion(volume, filesystem_schema)
          end
        end

        # @param volume [Volume]
        # @param filesystem [String]
        def filesystem_string_conversion(volume, filesystem)
          filesystems = volume.outline.filesystems

          fs_type = filesystems.find { |t| t.to_s == filesystem }
          volume.fs_type = fs_type if fs_type
        end

        # @param volume [Volume]
        # @param filesystem [Hash]
        def filesystem_hash_conversion(volume, filesystem)
          filesystem_string_conversion(volume, "btrfs")

          snapshots_value = filesystem.dig(:btrfs, :snapshots)
          return if !volume.outline.snapshots_configurable? || snapshots_value.nil?

          volume.btrfs.snapshots = snapshots_value
        end

        # @todo Support array format ([min, max]) and string format ("2 GiB")
        # @param volume [Volume]
        def size_conversion(volume)
          size_schema = volume_schema[:size]
          return unless size_schema

          if size_schema == "auto"
            volume.auto_size = true if volume.auto_size_supported?
          else
            volume.auto_size = false

            min_value = size_schema[:min]
            max_value = size_schema[:max]

            volume.min_size = Y2Storage::DiskSize.new(min_value)
            volume.max_size = if max_value
              Y2Storage::DiskSize.new(max_value)
            else
              Y2Storage::DiskSize.unlimited
            end
          end
        end

        def target_conversion(volume)
          target_schema = volume_schema[:target]
          return unless target_schema

          if target_schema == "default"
            volume.location.target = :default
            volume.location.device = nil
          elsif (device = target_schema[:newPartition])
            volume.location.target = :new_partition
            volume.location.device = device
          elsif (device = target_schema[:newVg])
            volume.location.target = :new_vg
            volume.location.device = device
          elsif (device = target_schema[:device])
            volume.location.target = :device
            volume.location.device = device
          elsif (device = target_schema[:filesystem])
            volume.location.target = :filesystem
            volume.location.device = device
          end
        end

        def default_volume
          Agama::Storage::VolumeTemplatesBuilder
            .new_from_config(config)
            .for(volume_schema.dig(:mount, :path))
        end
      end
    end
  end
end
