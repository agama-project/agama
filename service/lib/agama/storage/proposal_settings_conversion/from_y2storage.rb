# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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
      # Proposal settings conversion from Y2Storage format.
      class FromY2Storage
        # @param settings [Y2Storage::ProposalSettings]
        # @param config [Agama::Config]
        def initialize(settings, config:)
          @settings = settings
          @config = config
        end

        # Performs the conversion from Y2Storage format.
        #
        # @return [Agama::Storage::ProposalSettings]
        def convert
          ProposalSettings.new.tap do |target|
            boot_device_conversion(target)
            lvm_conversion(target)
            encryption_conversion(target)
            space_settings_conversion(target)
            volumes_conversion(target)
          end
        end

      private

        # @return [Y2Storage::ProposalSettings]
        attr_reader :settings

        # @return [Agama::Config]
        attr_reader :config

        # @param target [Agama::Storage::ProposalSettings]
        def boot_device_conversion(target)
          target.boot_device = settings.root_device
        end

        # @param target [Agama::Storage::ProposalSettings]
        def lvm_conversion(target)
          target.lvm.enabled = settings.lvm

          # FIXME: The candidate devices list represents the system VG devices if it contains any
          #   device different to the root device. If the candidate devices only contains the root
          #   device, then there is no way to know whether the root device was explicitly assigned
          #   as system VG device. Note that candidate devices will also contain the root device
          #   when the system VG devices list was empty.
          candidate_devices = settings.candidate_devices || []
          return unless candidate_devices.reject { |d| d == settings.root_device }.any?

          target.lvm.system_vg_devices = settings.candidate_devices
        end

        # @param target [Agama::Storage::ProposalSettings]
        def encryption_conversion(target)
          target.encryption.password = settings.encryption_password
          target.encryption.method = settings.encryption_method
          target.encryption.pbkd_function = settings.encryption_pbkdf
        end

        # @note The space policy cannot be inferred from Y2Storage settings.
        # @param target [Agama::Storage::ProposalSettings]
        def space_settings_conversion(target)
          target.space.actions = settings.space_settings.actions
        end

        # @param target [Agama::Storage::ProposalSettings]
        def volumes_conversion(target)
          target.volumes = volumes.select(&:proposed?).map do |spec|
            VolumeConversion.from_y2storage(spec, config: config)
          end

          fallbacks_conversion(target)
        end

        # @param target [Agama::Storage::ProposalSettings]
        def fallbacks_conversion(target)
          target.volumes.each do |volume|
            volume.min_size_fallback_for = volumes_with_min_size_fallback(volume.mount_path)
            volume.max_size_fallback_for = volumes_with_max_size_fallback(volume.mount_path)
          end
        end

        # @param mount_path [String]
        # @return [Array<String>]
        def volumes_with_min_size_fallback(mount_path)
          specs = volumes.select { |s| s.fallback_for_min_size == mount_path }
          specs.map(&:mount_point)
        end

        # @param mount_path [String]
        # @return [Array<String>]
        def volumes_with_max_size_fallback(mount_path)
          specs = volumes.select { |s| s.fallback_for_max_size == mount_path }
          specs.map(&:mount_point)
        end

        # Volumes from settings.
        #
        # Note that volumes might be nil in Y2Storage settings.
        #
        # @return [Array<Y2Storage::VolumeSpecification>]
        def volumes
          settings.volumes || []
        end
      end
    end
  end
end
