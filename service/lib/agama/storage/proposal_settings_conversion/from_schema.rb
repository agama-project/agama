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

require "agama/storage/boot_settings"
require "agama/storage/device_settings"
require "agama/storage/encryption_settings"
require "agama/storage/proposal_settings_reader"
require "agama/storage/space_settings"
require "agama/storage/volume_conversion"
require "y2storage/encryption_method"
require "y2storage/pbkd_function"

module Agama
  module Storage
    module ProposalSettingsConversion
      # Proposal settings conversion from Hash according to the JSON schema.
      class FromSchema
        # @param schema_settings [Hash]
        # @param config [Config]
        def initialize(schema_settings, config:)
          # @todo Raise error if schema_settings does not match the JSON schema.
          @schema_settings = schema_settings
          @config = config
        end

        # Performs the conversion from Hash according to the JSON schema.
        #
        # @return [ProposalSettings]
        def convert
          device_settings = target_conversion
          boot_settings = boot_conversion
          encryption_settings = encryption_conversion
          space_settings = space_conversion
          volumes = volumes_conversion

          Agama::Storage::ProposalSettingsReader.new(config).read.tap do |settings|
            settings.device = device_settings if device_settings
            settings.boot = boot_settings if boot_settings
            settings.encryption = encryption_settings if encryption_settings
            settings.space = space_settings if space_settings
            settings.volumes = add_required_volumes(volumes, settings.volumes) if volumes.any?
          end
        end

      private

        # @return [Hash]
        attr_reader :schema_settings

        # @return [Config]
        attr_reader :config

        def target_conversion
          target_schema = schema_settings[:target]
          return unless target_schema

          if target_schema == "disk"
            Agama::Storage::DeviceSettings::Disk.new
          elsif target_schema == "newLvmVg"
            Agama::Storage::DeviceSettings::NewLvmVg.new
          elsif (device = target_schema[:disk])
            Agama::Storage::DeviceSettings::Disk.new(device)
          elsif (devices = target_schema[:newLvmVg])
            Agama::Storage::DeviceSettings::NewLvmVg.new(devices)
          end
        end

        def boot_conversion
          boot_schema = schema_settings[:boot]
          return unless boot_schema

          Agama::Storage::BootSettings.new.tap do |boot_settings|
            boot_settings.configure = boot_schema[:configure]
            boot_settings.device = boot_schema[:device]
          end
        end

        def encryption_conversion
          encryption_schema = schema_settings[:encryption]
          return unless encryption_schema

          Agama::Storage::EncryptionSettings.new.tap do |encryption_settings|
            encryption_settings.password = encryption_schema[:password]

            if (method_value = encryption_schema[:method])
              method = Y2Storage::EncryptionMethod.find(method_value.to_sym)
              encryption_settings.method = method
            end

            if (function_value = encryption_schema[:pbkdFunction])
              function = Y2Storage::PbkdFunction.find(function_value)
              encryption_settings.pbkd_function = function
            end
          end
        end

        def space_conversion
          space_schema = schema_settings[:space]
          return unless space_schema

          Agama::Storage::SpaceSettings.new.tap do |space_settings|
            space_settings.policy = space_schema[:policy].to_sym

            actions_value = space_schema[:actions] || []
            space_settings.actions = actions_value.map { |a| action_conversion(a) }.inject(:merge)
          end
        end

        # @param action [Hash]
        def action_conversion(action)
          return action.invert unless action[:forceDelete]

          { action[:forceDelete] => :force_delete }
        end

        def volumes_conversion
          volumes_schema = schema_settings[:volumes]
          return [] unless volumes_schema

          volumes_schema.map do |volume_schema|
            VolumeConversion.from_schema(volume_schema, config: config)
          end
        end

        # Adds the missing required volumes to the list of volumes.
        #
        # @param volumes [Array<Volume>]
        # @param default_volumes [Array<Volume>] Default volumes including the required ones.
        #
        # @return [Array<Volume>]
        def add_required_volumes(volumes, default_volumes)
          mount_paths = volumes.map(&:mount_path)

          missing_required_volumes = default_volumes
            .select { |v| v.outline.required? }
            .reject { |v| mount_paths.include?(v.mount_path) }

          missing_required_volumes + volumes
        end
      end
    end
  end
end
