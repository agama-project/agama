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
        # @param backup [Agama::Storage::ProposalSettings] Settings used as backup to restore some
        #   values, see {FromY2Storage#restore_from_backup}.
        def initialize(settings, config:, backup: nil)
          @settings = settings
          @config = config
          @backup = backup
        end

        # Performs the conversion from Y2Storage format.
        #
        # @return [Agama::Storage::ProposalSettings]
        def convert
          ProposalSettings.new.tap do |target|
            target_device_conversion(target)
            lvm_conversion(target)
            encryption_conversion(target)
            space_settings_conversion(target)
            volumes_conversion(target)
            restore_from_backup(target)
          end
        end

      private

        # @return [Y2Storage::ProposalSettings]
        attr_reader :settings

        # @return [Agama::Config]
        attr_reader :config

        # @return [Agama::Storage::ProposalSettings, nil]
        attr_reader :backup

        # @param target [Agama::Storage::ProposalSettings]
        def target_device_conversion(target)
          target.target_device = settings.root_device
        end

        # @param target [Agama::Storage::ProposalSettings]
        def lvm_conversion(target)
          target.lvm.enabled = settings.lvm
          target.lvm.system_vg_devices = settings.candidate_devices if settings.lvm
        end

        # @param target [Agama::Storage::ProposalSettings]
        def encryption_conversion(target)
          target.encryption.password = settings.encryption_password
          target.encryption.method = settings.encryption_method
          target.encryption.pbkd_function = settings.encryption_pbkdf
        end

        # @param target [Agama::Storage::ProposalSettings]
        def space_settings_conversion(target)
          # Y2Storage does not manage the space policy concept. Let's assume custom.
          target.space.policy = :custom
          target.space.actions = settings.space_settings.actions
        end

        # @param target [Agama::Storage::ProposalSettings]
        def volumes_conversion(target)
          target.volumes = volumes.select(&:proposed?).map do |spec|
            VolumeConversion.from_y2storage(spec, config: config, backup: backup)
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

        # Restores values from a backup.
        #
        # @note Some values cannot be inferred from Y2Storage settings:
        #   * #target_device: if boot_device was set to a specific device, then the root_device
        #   from Y2Storage does not represent the target device.
        #   * #boot_device: it is not possible to know whether the Y2Storage root_device setting
        #   comes from a specific boot device or the target device.
        #   * #space.policy: Y2Storage does not manage a space policy, and it is impossible to infer
        #   a policy from the list of space actions.
        #
        #   All these values have to be restored from a settings backup.
        #
        # @return [Y2Storage::ProposalSettings]
        def restore_from_backup(target)
          return unless backup

          target.target_device = backup.target_device
          target.boot_device = backup.boot_device
          target.space.policy = backup.space.policy
        end
      end
    end
  end
end
