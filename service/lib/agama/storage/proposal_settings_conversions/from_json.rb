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

require "agama/storage/configs/boot"
require "agama/storage/device_settings"
require "agama/storage/encryption_settings"
require "agama/storage/proposal_settings_reader"
require "agama/storage/space_settings"
require "agama/storage/volume"
require "y2storage/encryption_method"
require "y2storage/pbkd_function"

module Agama
  module Storage
    module ProposalSettingsConversions
      # Proposal settings conversion from JSON hash according to schema.
      class FromJSON
        # @param settings_json [Hash]
        # @param config [Config]
        def initialize(settings_json, config:)
          @settings_json = settings_json
          @config = config
        end

        # Performs the conversion from Hash according to the JSON schema.
        #
        # @return [ProposalSettings]
        def convert
          # @todo Raise error if settings_json does not match the JSON schema.
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
        attr_reader :settings_json

        # @return [Config]
        attr_reader :config

        def target_conversion
          target_json = settings_json[:target]
          return unless target_json

          if target_json == "disk"
            Agama::Storage::DeviceSettings::Disk.new
          elsif target_json == "newLvmVg"
            Agama::Storage::DeviceSettings::NewLvmVg.new
          elsif (device = target_json[:disk])
            Agama::Storage::DeviceSettings::Disk.new(device)
          elsif (devices = target_json[:newLvmVg])
            Agama::Storage::DeviceSettings::NewLvmVg.new(devices)
          end
        end

        def boot_conversion
          boot_json = settings_json[:boot]
          return unless boot_json

          Agama::Storage::Configs::Boot.new.tap do |boot_settings|
            boot_settings.configure = boot_json[:configure]
            boot_settings.device = boot_json[:device]
          end
        end

        def encryption_conversion
          encryption_json = settings_json[:encryption]
          return unless encryption_json

          Agama::Storage::EncryptionSettings.new.tap do |encryption_settings|
            encryption_settings.password = encryption_json[:password]

            if (method_value = encryption_json[:method])
              method = Y2Storage::EncryptionMethod.find(method_value.to_sym)
              encryption_settings.method = method
            end

            if (function_value = encryption_json[:pbkdFunction])
              function = Y2Storage::PbkdFunction.find(function_value)
              encryption_settings.pbkd_function = function
            end
          end
        end

        def space_conversion
          space_json = settings_json[:space]
          return unless space_json

          Agama::Storage::SpaceSettings.new.tap do |space_settings|
            space_settings.policy = space_json[:policy].to_sym

            actions_value = space_json[:actions] || []
            space_settings.actions = actions_value.map { |a| action_conversion(a) }.inject(:merge)
          end
        end

        # @param action [Hash]
        def action_conversion(action)
          return action.invert unless action[:forceDelete]

          { action[:forceDelete] => :force_delete }
        end

        def volumes_conversion
          volumes_json = settings_json[:volumes]
          return [] unless volumes_json

          volumes_json.map do |volume_json|
            Volume.new_from_json(volume_json, config: config)
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
