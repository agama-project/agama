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

require "y2storage"
require "agama/storage/volume_conversion"
require "agama/storage/volume_templates_builder"

module Agama
  module Storage
    module ProposalSettingsConversion
      # Proposal settings conversion to Y2Storage format.
      class ToY2Storage
        # @param settings [Agama::Storage::ProposalSettings]
        # @param config [Agama::Config]
        def initialize(settings, config:)
          @settings = settings
          @config = config
        end

        # Performs the conversion to Y2Storage format.
        #
        # @return [Y2Storage::ProposalSettings]
        def convert
          # Despite the "current_product" part in the name of the constructor, it only applies
          # generic default values that are independent of the product (there is no YaST
          # ProductFeatures mechanism in place).
          Y2Storage::ProposalSettings.new_for_current_product.tap do |target|
            root_device_conversion(target)
            candidate_devices_conversion(target)
            lvm_conversion(target)
            encryption_conversion(target)
            space_policy_conversion(target)
            volumes_conversion(target)
          end
        end

      private

        # @return [Agama::Storage::ProposalSettings]
        attr_reader :settings

        # @return [Agama::Config]
        attr_reader :config

        # @param target [Y2Storage::ProposalSettings]
        def root_device_conversion(target)
          target.root_device = boot_device
        end

        # @param target [Y2Storage::ProposalSettings]
        def candidate_devices_conversion(target)
          candidates = settings.use_lvm? ? system_vg_devices : [boot_device]
          target.candidate_devices = candidates.compact
        end

        # @param target [Y2Storage::ProposalSettings]
        def lvm_conversion(target)
          target.lvm = settings.use_lvm?
          target.separate_vgs = settings.use_lvm?
          # Prevent VG reuse
          target.lvm_vg_reuse = false
          # Create VG as big as needed to allocate the LVs.
          target.lvm_vg_strategy = :use_needed
        end

        # @param target [Y2Storage::ProposalSettings]
        def encryption_conversion(target)
          target.encryption_password = settings.encryption.password
          target.encryption_method = settings.encryption.method
          target.encryption_pbkdf = settings.encryption.pbkd_function
        end

        # @param target [Y2Storage::ProposalSettings]
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

        # @param target [Y2Storage::ProposalSettings]
        def volumes_conversion(target)
          target.swap_reuse = :none

          volumes = settings.volumes.map { |v| VolumeConversion.to_y2storage(v) }

          disabled_volumes = missing_volumes.map do |volume|
            VolumeConversion.to_y2storage(volume).tap { |v| v.proposed = false }
          end

          target.volumes = volumes + disabled_volumes

          device_conversion(target)
          fallbacks_conversion(target)
        end

        # @return [Array<Agama::Storage::Volume>]
        def missing_volumes
          mount_paths = settings.volumes.map(&:mount_path)

          VolumeTemplatesBuilder.new_from_config(config).all
            .reject { |t| mount_paths.include?(t.mount_path) }
            .reject { |t| t.mount_path.empty? }
        end

        # Assigns the target device if needed.
        #
        # If LVM is not used, then the volumes have to specify a device, using the target device by
        # default if no device was directly assigned to the volume.
        #
        # @param target [Y2Storage::ProposalSettings]
        def device_conversion(target)
          return if settings.use_lvm?

          target.volumes.select(&:proposed?).each { |v| v.device ||= settings.target_device }
        end

        # @param target [Y2Storage::ProposalSettings]
        def fallbacks_conversion(target)
          target.volumes.each do |spec|
            min_size_fallback = find_min_size_fallback(spec.mount_point)
            max_size_fallback = find_max_size_fallback(spec.mount_point)

            spec.fallback_for_min_size = min_size_fallback
            spec.fallback_for_max_size = max_size_fallback
            spec.fallback_for_max_size_lvm = max_size_fallback
          end
        end

        # @param mount_path [String, nil] nil if not found
        def find_min_size_fallback(mount_path)
          volume = settings.volumes.find { |v| v.min_size_fallback_for.include?(mount_path) }
          volume&.mount_path
        end

        # @param mount_path [String, nil] nil if not found
        def find_max_size_fallback(mount_path)
          volume = settings.volumes.find { |v| v.max_size_fallback_for.include?(mount_path) }
          volume&.mount_path
        end

        def target_device
          # If using LVM, then the target device is ignored.
          return nil if settings.use_lvm?

          settings.target_device
        end

        def boot_device
          # In using LVM, no default boot device is given, delegating to Y2Storage the
          # responsibility of selecting a device, see {#target_device}.
          settings.boot_device || target_device
        end

        def system_vg_devices
          return [] unless settings.use_lvm?

          settings.lvm.system_vg_devices
        end

        # All block devices affected by the space policy.
        #
        # The affected devices are:
        # * The target device if LVM is not used.
        # * The boot device if any.
        # * The devices for the system VG if LVM is used.
        # * The devices directly assigned to a volume.
        #
        # If a device is partitioned, then its partitions are included instead of the device.
        #
        # @return [Array<String>]
        def all_devices
          devices = [target_device, boot_device] +
            system_vg_devices +
            settings.volumes.map(&:device)

          devices.compact.uniq.map { |d| device_or_partitions(d) }.flatten
        end

        # @param device [String]
        # @return [String, Array<String>]
        def device_or_partitions(device)
          partitions = partitions(device)
          partitions.empty? ? device : partitions
        end

        # @param device [String]
        # @return [Array<String>]
        def partitions(device)
          device_object = devicegraph.find_by_name(device)
          return [] unless device_object

          device_object.partitions.map(&:name)
        end

        # @return [Y2Storage::Devicegraph]
        def devicegraph
          Y2Storage::StorageManager.instance.probed
        end
      end
    end
  end
end
