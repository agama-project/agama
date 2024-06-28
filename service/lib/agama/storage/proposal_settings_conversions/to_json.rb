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

require "agama/storage/device_settings"

module Agama
  module Storage
    module ProposalSettingsConversions
      # Proposal settings conversion to JSON hash according to schema.
      class ToJSON
        # @param settings [ProposalSettings]
        def initialize(settings)
          @settings = settings
        end

        # Performs the conversion to JSON.
        #
        # @return [Hash]
        def convert
          {
            target:  target_conversion,
            boot:    boot_conversion,
            space:   space_conversion,
            volumes: volumes_conversion
          }.tap do |settings_json|
            encryption_json = encryption_conversion
            settings_json[:encryption] = encryption_json if encryption_json
          end
        end

      private

        # @return [ProposalSettings]
        attr_reader :settings

        def target_conversion
          device_settings = settings.device

          case device_settings
          when Agama::Storage::DeviceSettings::Disk
            device = device_settings.name
            device ? { disk: device } : "disk"
          when Agama::Storage::DeviceSettings::NewLvmVg
            candidates = device_settings.candidate_pv_devices
            candidates.any? ? { newLvmVg: candidates } : "newLvmVg"
          end
        end

        def boot_conversion
          {
            configure: settings.boot.configure?
          }.tap do |boot_json|
            device = settings.boot.device
            boot_json[:device] = device if device
          end
        end

        def encryption_conversion
          return unless settings.encryption.encrypt?

          {
            password: settings.encryption.password,
            method:   settings.encryption.method.id.to_s
          }.tap do |encryption_json|
            function = settings.encryption.pbkd_function
            encryption_json[:pbkdFunction] = function.value if function
          end
        end

        def space_conversion
          {
            policy:  settings.space.policy.to_s,
            actions: settings.space.actions.map { |d, a| { action_key(a) => d } }
          }
        end

        def action_key(action)
          return action.to_sym if action.to_s != "force_delete"

          :forceDelete
        end

        def volumes_conversion
          settings.volumes.map(&:to_json_settings)
        end
      end
    end
  end
end
