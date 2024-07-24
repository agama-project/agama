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

require "agama/storage/config_conversions/encrypt/from_json"
require "agama/storage/config_conversions/format/from_json"
require "agama/storage/config_conversions/mount/from_json"
require "agama/storage/configs/encrypt"
require "agama/storage/configs/filesystem"
require "agama/storage/configs/format"
require "agama/storage/configs/mount"

module Agama
  module Storage
    module ConfigConversions
      module BlockDevice
        # Block device conversion from JSON hash according to schema.
        class FromJSON
          # @todo Replace settings and volume_builder params by a ProductDefinition.
          #
          # @param drive_json [Hash]
          # @param settings [ProposalSettings]
          # @param volume_builder [VolumeTemplatesBuilder]
          def initialize(blk_device_json, settings:, volume_builder:)
            @blk_device_json = blk_device_json
            @settings = settings
            @volume_builder = volume_builder
          end

          # Performs the conversion from Hash according to the JSON schema.
          #
          # @param config [#encrypt=, #format=, #mount=]
          def convert(config)
            config.encrypt = convert_encrypt
            config.format = convert_format
            config.mount = convert_mount
            config
          end

        private

          # @return [Hash]
          attr_reader :blk_device_json

          # @return [ProposalSettings]
          attr_reader :settings

          # @return [VolumeTemplatesBuilder]
          attr_reader :volume_builder

          # @return [Configs::Encrypt, nil]
          def convert_encrypt
            encrypt_json = blk_device_json[:encrypt]
            return unless encrypt_json

            Encrypt::FromJSON.new(encrypt_json, default: default_encrypt_config).convert
          end

          # @return [Configs::Format, nil]
          def convert_format
            format_json = blk_device_json[:format]
            mount_json = blk_device_json[:mount]

            return if format_json == false # "format": false
            return if format_json.nil? && mount_json.nil?

            default = default_format_config(mount_json&.dig(:path) || "")
            return default unless format_json

            # @todo Check whether the given filesystem can be used for the mount point.
            # @todo Check whether snapshots can be configured and restore to default if needed.

            Format::FromJSON.new(format_json).convert(default)
          end

          # @return [Configs::Mount, nil]
          def convert_mount
            mount_json = blk_device_json[:mount]
            return unless mount_json

            Mount::FromJSON.new(mount_json).convert
          end

          # @todo Recover values from ProductDefinition instead of ProposalSettings.
          #
          # Default encryption config from the product definition.
          #
          # @return [Configs::Encrypt]
          def default_encrypt_config
            Configs::Encrypt.new.tap do |config|
              config.key = settings.encryption.password
              config.method = settings.encryption.method
              config.pbkd_function = settings.encryption.pbkd_function
            end
          end

          # Default format config from the product definition.
          #
          # @param mount_path [String]
          # @return [Configs::Format]
          def default_format_config(mount_path)
            Configs::Format.new.tap do |config|
              config.filesystem = default_filesystem_config(mount_path)
            end
          end

          # @todo Recover values from ProductDefinition instead of VolumeTemplatesBuilder.
          #
          # Default filesystem config from the product definition.
          #
          # @param mount_path [String]
          # @return [Configs::Filesystem]
          def default_filesystem_config(mount_path)
            volume = volume_builder.for(mount_path)

            Configs::Filesystem.new.tap do |config|
              config.type = volume.fs_type
              config.btrfs = volume.btrfs
            end
          end
        end
      end
    end
  end
end
