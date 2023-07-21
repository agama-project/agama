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

require "y2storage"
require "agama/storage/volume_conversion"

module Agama
  module Storage
    module ProposalSettingsConversion
      # Utility class offering methods to convert between Y2Storage::ProposalSettings objects and
      # Agama::ProposalSettings ones
      # Internal class to generate a Y2Storage::ProposalSettings object
      class ToY2Storage
        # Constructor
        #
        # @param settings [ProposalSettings]
        # @param default_specs [Array<Y2Storage::VolumeSpecification>]
        def initialize(settings)
          @settings = settings
        end

        # @return [Y2Storage::ProposalSettings]
        def convert
          # Despite the "current_product" part in the name of the constructor, it only applies
          # generic default values that are independent of the product (there is no YaST
          # ProductFeatures mechanism in place).
          y2storage_settings = Y2Storage::ProposalSettings.new_for_current_product

          y2storage_settings.candidate_devices = candidate_devices

          boot_device_conversion(y2storage_settings)
          lvm_conversion(y2storage_settings)
          encryption_conversion(y2storage_settings)
          space_policy_conversion(y2storage_settings)
          volumes_conversion(y2storage_settings)

          y2storage_settings
        end

      private

        # @see ProposalSettingsConverter#to_y2storage
        # @return [ProposalSettings]
        attr_reader :settings

        def boot_device_conversion(target)
          target.root_device = settings.boot_device
        end

        def lvm_conversion(target)
          lvm = settings.lvm.enabled?

          target.lvm = lvm
          target.separate_vgs = lvm
        end

        # Sets the attributes related to encryption
        #
        # @param y2storage_settings [Y2Storage::ProposalSettings] target settings to be adapted
        def encryption_conversion(target)
          target.encryption_password = settings.encryption.password
          target.encryption_method = settings.encryption.method
          target.encryption_pbkdf = settings.encryption.pbkd_function
        end

        def space_policy_conversion(target)
          target.space_settings.strategy = :bigger_resize

          actions = case settings.space.policy
            when :delete
              all_devices.each_with_object({}) { |d, a| a[d] = :force_delete }
            when :resize
              all_devices.each_with_object({}) { |d, a| a[d] = :resize }
            when :keep
              {}
            when :custom
              settings.space.actions
          end

          target.space_settings.actions = actions
        end

        def volumes_conversion(target)
          target.volumes = settings.volumes.map { |v| VolumeConversion.to_y2storage(v) }
          fallbacks_conversion(settings.volumes, target.volumes)
        end

        def fallbacks_conversion(volumes, target_volumes)
          target_volumes.each do |spec|
            spec.min_size_fallback = find_min_size_fallback(spec.mount_point, volumes)
            spec.max_size_fallback = find_max_size_fallback(spec.mount_point, volumes)
          end
        end

        def find_min_size_fallback(mount_path, volumes)
          volumes.find { |v| v.min_size_fallback_for.include?(mount_path) }
        end

        def find_max_size_fallback(mount_path, volumes)
          volumes.find { |v| v.max_size_fallback_for.include?(mount_path) }
        end

        def candidate_devices
          devices = [settings.boot_device]
          devices += settings.lvm.system_vg_devices if settings.lvm.enabled?

          devices.compact.uniq
        end

        def all_devices
          devices = candidate_devices
          devices += settings.volumes.map { |v| v.device }

          devices.uniq.map { |d| device_or_partitions(d) }.flatten
        end

        def device_or_partitions(device)
          partitions = devicegraph.find_by_name(device).partitions.map(&:name)

          partitions.any? ? partitions : device
        end

        def devicegraph
          Y2Storage::StorageManager.instance.probed
        end
      end
    end
  end
end
