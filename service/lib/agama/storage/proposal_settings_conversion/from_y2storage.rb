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

require "agama/storage/proposal_settings"
require "agama/storage/volume_conversion"

module Agama
  module Storage
    module ProposalSettingsConversion
      # Utility class offering methods to convert between Y2Storage::ProposalSettings objects and
      # Agama::ProposalSettings ones
      # Internal class to generate a ProposalSettings object
      class FromY2Storage
        # Constructor
        #
        # @param y2storage_settings [Y2Storage::ProposalSettings]
        # @param default_specs [Array<Y2Storage::VolumeSpecification>]
        # @param devices [Array<Y2Storage::Planned::Device>]
        def initialize(settings, config:)
          @settings = settings
          @config = config
        end

        # @return [ProposalSettings]
        def convert
          ProposalSettings.new.tap do |target|
            boot_devices_conversion(target)
            lvm_conversion(target)
            encryption_conversion(target)
            space_policy_conversion(target)
            volumes_conversion(target)
          end
        end

      private

        attr_reader :settings

        attr_reader :config

        def boot_device_conversion(target)
          target.boot_device = settings.root_device
        end

        def lvm_conversion(target)
          target.lvm.enabled = settings.lvm
          target.lvm.system_vg_devices = settings.candidate_devices if settings.lvm
        end

        def encryption_conversion(target)
          target.encryption.password = settings.encryption_password
          target.encryption.method = settings.encryption_method
          target.encryption.pbkd_function = settings.encryption_pbkdf
        end

        def space_policy_conversion(target)
          policy = settings.space_settings.strategy

          target.space.policy = policy
          target.space.actions = settings.space_settings.actions if policy == :bigger_resize
        end

        def volumes_conversion(target)
          target.volumes = settings.volumes.map do |spec|
            VolumeConversion.from_y2storage(spec, config: config)
          end

          fallbacks_conversion(target)
        end

        def fallbacks_conversion(target)
          target.volumes.each do |volume|
            volume.min_size_fallback_for = volumes_with_min_size_fallback(volume.mount_path)
            volume.max_size_fallback_for = volumes_with_max_size_fallback(volume.mount_path)
          end
        end

        def volumes_with_min_size_fallback(mount_path)
          specs = settings.volumes.select { |s| s.min_size_fallback == mount_path }
          specs.map(&:mount_point)
        end

        def volumes_with_max_size_fallback(mount_path)
          specs = settings.volumes.select { |s| s.max_size_fallback == mount_path }
          specs.map(&:mount_point)
        end
      end
    end
  end
end
