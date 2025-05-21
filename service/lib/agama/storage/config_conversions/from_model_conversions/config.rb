# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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

require "agama/storage/config_conversions/from_model_conversions/base"
require "agama/storage/config_conversions/from_model_conversions/boot"
require "agama/storage/config_conversions/from_model_conversions/drive"
require "agama/storage/config_conversions/from_model_conversions/md_raid"
require "agama/storage/config_conversions/from_model_conversions/volume_group"
require "agama/storage/config"

module Agama
  module Storage
    module ConfigConversions
      module FromModelConversions
        # Config conversion from model according to the JSON schema.
        class Config < Base
          # @param model_json [Hash]
          # @param product_config [Agama::Config]
          def initialize(model_json, product_config)
            super(model_json)
            @product_config = product_config
          end

        private

          # @return [Agama::Config]
          attr_reader :product_config

          # @see Base
          # @return [Storage::Config]
          def default_config
            Storage::Config.new
          end

          # @see Base#conversions
          # @return [Hash]
          def conversions
            drives = convert_drives
            raids = convert_raids
            partitionables = Array(drives) + Array(raids)

            {
              boot:          convert_boot(partitionables),
              drives:        drives,
              md_raids:      raids,
              volume_groups: convert_volume_groups(partitionables)
            }
          end

          # @param targets [Array<Configs::Drive, Configs::MdRaid>]
          # @return [Configs::Boot, nil]
          def convert_boot(targets)
            boot_model = model_json[:boot]
            return unless boot_model

            FromModelConversions::Boot.new(boot_model, targets).convert
          end

          # @return [Array<Configs::Drive>, nil]
          def convert_drives
            add_missing_drives

            drive_models = model_json[:drives]
            return unless drive_models

            drive_models.map { |d| convert_drive(d) }
          end

          # @param drive_model [Hash]
          # @return [Configs::Drive]
          def convert_drive(drive_model)
            FromModelConversions::Drive
              .new(drive_model, product_config, model_json[:encryption])
              .convert
          end

          # @return [Array<Configs::MdRaid>, nil]
          def convert_raids
            raid_models = model_json[:mdRaids]
            return unless raid_models

            raid_models.map { |d| convert_raid(d) }
          end

          # @param raid_model [Hash]
          # @return [Configs::raid]
          def convert_raid(raid_model)
            FromModelConversions::MdRaid
              .new(raid_model, product_config, model_json[:encryption])
              .convert
          end

          # @param targets [Array<Configs::Drive, Configs::MdRaid>]
          # @return [Hash<Configs::VolumeGroup>]
          def convert_volume_groups(targets)
            volume_group_models = model_json[:volumeGroups]
            return unless volume_group_models

            volume_group_models.map { |v| convert_volume_group(v, targets) }
          end

          # @param volume_group_model [Hash]
          # @param targets [Array<Configs::Drive, Configs::MdRaid>]
          #
          # @return [Configs::VolumeGroup]
          def convert_volume_group(volume_group_model, targets)
            FromModelConversions::VolumeGroup
              .new(volume_group_model, targets, model_json[:encryption])
              .convert
          end

          # Add missing drives to the model.
          #
          # Adds a drive for the selected boot device and for the LVM target devices if needed.
          #
          # TODO: This considers the missing device is always a drive (never a reused MD RAID).
          # That's enough for now because the reused MD RAIDs are always included in the model. This
          # must be revisited when more features will be supported (e.g., selecting a MD RAID as
          # boot device or as target for physical volumes).
          #
          # @return [Array<Hash>, nil]
          def add_missing_drives
            model_json[:drives] ||= []
            drives = model_json[:drives]

            # Add boot device, if needed.
            drives << boot_device if missing_boot_device?

            # Add target devices, if needed.
            lvm_target_names.each do |name|
              drives << lvm_target_device(name) if missing_partitionable?(name)
            end
          end

          # Whether the boot drive is missing in the model.
          #
          # @return [Boolean]
          def missing_boot_device?
            configure_boot = model_json.dig(:boot, :configure)
            default_boot = model_json.dig(:boot, :device, :default)
            boot_device_name = model_json.dig(:boot, :device, :name)

            return false unless configure_boot && !default_boot && !boot_device_name.nil?

            missing_partitionable?(boot_device_name)
          end

          # Whether a drive with the given name is missing in the model.
          #
          # @param name [String]
          # @return [Boolean]
          def missing_drive?(name)
            drives = model_json[:drives] || []
            drives.none? { |d| d[:name] == name }
          end

          # Whether a RAID with the given name is missing in the model.
          #
          # @param name [String]
          # @return [Boolean]
          def missing_raid?(name)
            raids = model_json[:mdRaids] || []
            raids.none? { |d| d[:name] == name }
          end

          # Whether a partitionable device with the given name is missing in the model.
          #
          # @param name [String]
          # @return [Boolean]
          def missing_partitionable?(name)
            missing_drive?(name) && missing_raid?(name)
          end

          # All the target devices for creating LVM physical volumes.
          #
          # @return [Array<String>]
          def lvm_target_names
            volume_groups = model_json[:volumeGroups] || []
            volume_groups.flat_map { |v| v[:targetDevices] || [] }
          end

          # Drive model for the boot device.
          #
          # @return [Hash]
          def boot_device
            name = model_json.dig(:boot, :device, :name)

            # The main use case for using a specific device for booting is to share the boot
            # partition with other installed systems. So let's ensure the partitions are not deleted
            # by setting the "keep" space policy.
            { name: name, spacePolicy: "keep" }
          end

          # Drive model for a LVM target device.
          #
          # @param name [String]
          # @return [Hash]
          def lvm_target_device(name)
            { name: name, spacePolicy: product_config.space_policy }
          end
        end
      end
    end
  end
end
