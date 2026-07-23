# frozen_string_literal: true

# Copyright (c) [2025-2026] SUSE LLC
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

require "agama/storage/model_refuse_encryption"

module Agama
  module Storage
    # Class for checking whether a config is supported by the config model.
    #
    # Features will be added to the config model little by little. Ideally, this class will
    # dissapear once the model supports all the features provided by the config.
    class ModelSupportChecker
      include ModelRefuseEncryption

      # @note A solved config is expected. Otherwise some checks cannot be done reliably.
      #
      # @param config [Storage::Config]
      def initialize(config)
        @config = config
      end

      # Whether the config is completely supported by the config model.
      #
      # @return [Booelan]
      def supported?
        return @supported unless @supported.nil?

        @supported = !unsupported_config?
      end

    private

      # @return [Storage::Config]
      attr_reader :config

      # Whether the config is not supported by the config model.
      #
      # @return [Boolean]
      def unsupported_config? # rubocop:disable Metrics/CyclomaticComplexity, Metrics/PerceivedComplexity
        any_unsupported_device? ||
          any_partitionable_without_name? ||
          any_volume_group_without_name? ||
          any_volume_group_with_pvs? ||
          any_volume_without_mount_path? ||
          any_logical_volume_with_encryption? ||
          any_different_encryption? ||
          any_missing_encryption? ||
          any_extra_encryption?
      end

      # Whether there is any device that is not supported by the model.
      #
      # @return [Boolean]
      def any_unsupported_device?
        thin_pools = config.valid_logical_volumes.select(&:pool?)
        thin_volumes = config.valid_logical_volumes.select(&:thin_volume?)

        [
          config.btrfs_raids,
          config.nfs_mounts,
          thin_pools,
          thin_volumes
        ].flatten.any?
      end

      # Whether there is any mandatory drive or reused MD RAID without a name.
      #
      # So far, only existing MD RAIDs are supported.
      #
      # @return [Boolean]
      def any_partitionable_without_name?
        config.supporting_partitions.any? do |device_config|
          !device_config.found_device &&
            !device_config.search&.skip_device? &&
            !device_config.search&.condition_name
        end
      end

      # Whether there is any volume group without a name.
      #
      # @return [Boolean]
      def any_volume_group_without_name?
        !config.valid_volume_groups.all?(&:name)
      end

      # Only volume groups with automatically generated physical volumes are supported.
      # @todo Revisit this check once individual physical volumes are supported by the model.
      #
      # @return [Boolean]
      def any_volume_group_with_pvs?
        config.valid_volume_groups.any? { |v| v.physical_volumes.any? }
      end

      # Whether there is any logical volume with encryption.
      #
      # @return [Boolean]
      def any_logical_volume_with_encryption?
        config.valid_logical_volumes.any?(&:encryption)
      end

      # Whether there is any volume (i.e., partition or logical volume) with missing mount path.
      # @see #need_mount_path?
      #
      # @return [Boolean]
      def any_volume_without_mount_path?
        config.volumes.any? { |v| need_mount_path?(v) && !v.filesystem&.path }
      end

      # Whether the volume config requires a mount path.
      #
      # A mount path is required for all the volumes (i.e., partitions or logical volumes) that are
      # going to be created. For a config reusing an existing device, the mount path is required
      # only if the volume does not represent a space policy action (delete or resize).
      #
      # @todo Revisit this check once individual physical volumes are supported by the model. The
      #   partitions representing the new physical volumes would not need a mount path.
      #
      # @param volume_config [Configs::Partition, Configs::LogicalVolume]
      # @return [Boolean]
      def need_mount_path?(volume_config)
        return true if new_volume?(volume_config)

        reused_volume?(volume_config) &&
          !delete_action?(volume_config) &&
          !resize_action?(volume_config)
      end

      # Whether the config represents a new volume (i.e., partition or logical volume) to be
      # created.
      #
      # @note The config has to be solved. Otherwise, in some cases it would be impossible to
      #   determine whether the volume is going to be created or reused. For example, if the
      #   config has a search and #if_not_found is set to :create.
      #
      # @param volume_config [Configs::Partition, Configs::LogicalVolume]
      # @return [Boolean]
      def new_volume?(volume_config)
        volume_config.search.nil? || volume_config.search.create_device?
      end

      # Whether the config is reusing an existing volume (i.e., partition or logical volume).
      #
      # @note The config has to be solved. Otherwise, in some cases it would be impossible to
      #   determine whether the volume is going to be reused or skipped.
      #
      # @param volume_config [Configs::Partition, Configs::LogicalVolume]
      # @return [Boolean]
      def reused_volume?(volume_config)
        !new_volume?(volume_config) && !volume_config.search.skip_device?
      end

      # Whether the volume (i.e., partition or logical volume) is configured to be deleted or
      # deleted if needed.
      #
      # @param volume_config [Configs::Partition, Configs::LogicalVolume]
      # @return [Boolean]
      def delete_action?(volume_config)
        return false unless reused_volume?(volume_config)

        volume_config.delete? || volume_config.delete_if_needed?
      end

      # Whether the volume (i.e., partition or logical volume) is configured to be resized if
      # needed.
      #
      # @param volume_config [Configs::Partition, Configs::LogicalVolume]
      # @return [Boolean]
      def resize_action?(volume_config)
        return false unless reused_volume?(volume_config)

        volume_config.filesystem.nil? &&
          volume_config.encryption.nil? &&
          volume_config.size &&
          !volume_config.size.default? &&
          volume_config.size.min == Y2Storage::DiskSize.zero
      end

      # Whether there are different encryptions.
      #
      # The model only supports a general encryption that applies to everything.
      #
      # @return [Boolean]
      def any_different_encryption?
        config.valid_encryptions.uniq.size > 1
      end

      # Whether an encryption is missing.
      #
      # @return [Boolean]
      def any_missing_encryption?
        any_missing_device_encryption? || any_missing_volume_group_encryption?
      end

      # The model generates an encryption for all formatted devices if the filesystem is not reused.
      # @see #any_missing_encryption?
      #
      # @return [Boolean]
      def any_missing_device_encryption?
        return false if config.valid_encryptions.none?

        [config.valid_drives, config.valid_md_raids, config.valid_partitions]
          .flatten
          .reject(&:encryption)
          .select(&:filesystem)
          .reject { |c| c.filesystem.reuse? }
          .reject { |c| c.filesystem.path && refuse_encryption_path?(c.filesystem.path) }
          .any?
      end

      # The model generates a encryption for the target devices for physical volumes.
      # @see #any_missing_encryption?
      #
      # @return [Boolean]
      def any_missing_volume_group_encryption?
        return false if config.valid_encryptions.none?

        config.valid_volume_groups
          .reject { |c| c.physical_volumes_devices.none? }
          .reject(&:physical_volumes_encryption)
          .any?
      end

      # Whether there is an extra encryption.
      #
      # The model does not encrypt a device if the device is not formatted or its filesystem is
      # reused.
      #
      # @return [Boolean]
      def any_extra_encryption?
        [config.valid_drives, config.valid_md_raids, config.valid_partitions]
          .flatten
          .select(&:encryption)
          .select { |c| c.filesystem.nil? || c.filesystem.reuse? }
          .any?
      end
    end
  end
end
