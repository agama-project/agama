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

require "agama/storage/config_conversions/from_json_conversions/encryption"
require "agama/storage/config_conversions/from_json_conversions/filesystem"
require "agama/storage/config_conversions/from_json_conversions/filesystem_type"
require "agama/storage/configs/encryption"
require "agama/storage/configs/filesystem"
require "agama/storage/configs/filesystem_type"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Block device conversion from JSON hash according to schema.
        class BlockDevice
          # @todo Replace settings and volume_builder params by a ProductDefinition.
          #
          # @param blk_device_json [Hash]
          # @param settings [ProposalSettings]
          # @param volume_builder [VolumeTemplatesBuilder]
          def initialize(blk_device_json, settings:, volume_builder:)
            @blk_device_json = blk_device_json
            @settings = settings
            @volume_builder = volume_builder
          end

          # Performs the conversion from Hash according to the JSON schema.
          #
          # @param default [Configs::Drive, Configs::Partition]
          # @return [Configs::Drive, Configs::Partition]
          def convert(default)
            default.dup.tap do |config|
              config.encryption = convert_encrypt
              config.filesystem = convert_filesystem
            end
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
            encrypt_json = blk_device_json[:encryption]
            return unless encrypt_json

            FromJSONConversions::Encryption
              .new(encrypt_json, default: default_encrypt_config)
              .convert
          end

          # @return [Configs::Filesystem, nil]
          def convert_filesystem
            filesystem_json = blk_device_json[:filesystem]
            return if filesystem_json.nil?

            default = default_filesystem_config(filesystem_json&.dig(:path) || "")

            # @todo Check whether the given filesystem can be used for the mount point.
            # @todo Check whether snapshots can be configured and restore to default if needed.

            FromJSONConversions::Filesystem.new(filesystem_json).convert(default)
          end

          # @todo Recover values from ProductDefinition instead of ProposalSettings.
          #
          # Default encryption config from the product definition.
          #
          # @return [Configs::Encryption]
          def default_encrypt_config
            Configs::Encryption.new.tap do |config|
              config.password = settings.encryption.password
              config.method = settings.encryption.method
              config.pbkd_function = settings.encryption.pbkd_function
            end
          end

          # Default format config from the product definition.
          #
          # @param mount_path [String]
          # @return [Configs::Filesystem]
          def default_filesystem_config(mount_path)
            Configs::Filesystem.new.tap do |config|
              config.type = default_fstype_config(mount_path)
            end
          end

          # @todo Recover values from ProductDefinition instead of VolumeTemplatesBuilder.
          #
          # Default filesystem config from the product definition.
          #
          # @param mount_path [String]
          # @return [Configs::FilesystemType]
          def default_fstype_config(mount_path)
            volume = volume_builder.for(mount_path)

            Configs::FilesystemType.new.tap do |config|
              config.fs_type = volume.fs_type
              config.btrfs = volume.btrfs
            end
          end
        end
      end
    end
  end
end
