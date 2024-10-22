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

require "agama/issue"
require "agama/storage/volume_templates_builder"
require "yast/i18n"
require "y2storage/mount_point"

module Agama
  module Storage
    # Class for checking a storage config.
    #
    # TODO: Split in smaller checkers, for example: ConfigFilesystemChecker, etc.
    class ConfigChecker # rubocop:disable Metrics/ClassLength
      include Yast::I18n

      # @param config [Storage::Config]
      # @param product_config [Agama::Config]
      def initialize(config, product_config)
        textdomain "agama"
        @config = config
        @product_config = product_config || Agama::Config.new
      end

      # Issues detected in the config.
      #
      # @return [Array<Issue>]
      def issues
        drives_issues + volume_groups_issues
      end

    private

      # @return [Storage::Config]
      attr_reader :config

      # @return [Agama::Config]
      attr_reader :product_config

      # Issues from drives.
      #
      # @return [Array<Issue>]
      def drives_issues
        config.drives.flat_map { |d| drive_issues(d) }
      end

      # Issues from a drive config.
      #
      # @param config [Configs::Drive]
      # @return [Array<Issue>]
      def drive_issues(config)
        [
          search_issue(config),
          filesystem_issues(config),
          encryption_issues(config),
          partitions_issues(config)
        ].flatten.compact
      end

      # Issue for not found device.
      #
      # @param config [Configs::Drive, Configs::Partition]
      # @return [Agama::Issue]
      def search_issue(config)
        return if !config.search || config.found_device

        if config.is_a?(Agama::Storage::Configs::Drive)
          if config.search.skip_device?
            warning(_("No device found for an optional drive"))
          else
            error(_("No device found for a mandatory drive"))
          end
        elsif config.search.skip_device?
          warning(_("No device found for an optional partition"))
        else
          error(_("No device found for a mandatory partition"))
        end
      end

      # Issues related to the filesystem.
      #
      # @param config [#filesystem]
      # @return [Array<Issue>]
      def filesystem_issues(config)
        filesystem = config.filesystem
        return [] unless filesystem

        [
          missing_filesystem_issue(filesystem),
          invalid_filesystem_issue(filesystem)
        ].compact
      end

      # @see #filesystem_issues
      #
      # @param config [Configs::Filesystem]
      # @return [Issue, nil]
      def missing_filesystem_issue(config)
        return if config.reuse?
        return if config.type&.fs_type

        error(
          format(
            # TRANSLATORS: %s is the replaced by a mount path (e.g., "/home").
            _("Missing file system type for '%s'"),
            config.path
          )
        )
      end

      # @see #filesystem_issues
      #
      # @param config [Configs::Filesystem]
      # @return [Issue, nil]
      def invalid_filesystem_issue(config)
        return if config.reuse?

        type = config.type&.fs_type
        return unless type

        path = config.path
        types = suitable_filesystem_types(path)
        return if types.include?(type)

        # Let's consider a type as valid if the product does not define any suitable type.
        return if types.empty?

        error(
          format(
            # TRANSLATORS: %{filesystem} is replaced by a file system type (e.g., "Btrfs") and
            #   %{path} is replaced by a mount path (e.g., "/home").
            _("The file system type '%{filesystem}' is not suitable for '%{path}'"),
            filesystem: type.to_human_string,
            path:       path
          )
        )
      end

      # Issues related to encryption.
      #
      # @param config [Configs::Drive, Configs::Partition, Configs::LogicalVolume]
      # @return [Array<Issue>]
      def encryption_issues(config)
        encryption = config.encryption
        return [] unless encryption

        [
          missing_encryption_password_issue(encryption),
          unavailable_encryption_method_issue(encryption),
          wrong_encryption_method_issue(config)
        ].compact
      end

      # @see #encryption_issues
      #
      # @param config [Configs::Encryption]
      # @return [Issue, nil]
      def missing_encryption_password_issue(config)
        return unless config.missing_password?

        error(
          format(
            # TRANSLATORS: 'crypt_method' is the identifier of the method to encrypt the device
            #   (e.g., 'luks1', 'random_swap').
            _("No passphrase provided (required for using the method '%{crypt_method}')."),
            crypt_method: config.method.to_human_string
          )
        )
      end

      # @see #encryption_issues
      #
      # @param config [Configs::Encryption]
      # @return [Issue, nil]
      def unavailable_encryption_method_issue(config)
        method = config.method
        return if !method || available_encryption_methods.include?(method)

        error(
          format(
            # TRANSLATORS: 'crypt_method' is the identifier of the method to encrypt the device
            #   (e.g., 'luks1', 'random_swap').
            _("Encryption method '%{crypt_method}' is not available in this system."),
            crypt_method: method.to_human_string
          )
        )
      end

      # @see #unavailable_encryption_method_issue
      #
      # @return [Array<Y2Storage::EncryptionMethod::Base>]
      def available_encryption_methods
        tpm_fde = Y2Storage::EncryptionMethod::TPM_FDE

        methods = Y2Storage::EncryptionMethod.available
        methods << tpm_fde if tpm_fde.possible?
        methods
      end

      # @see #encryption_issues
      #
      # @param config [Configs::Drive, Configs::Partition, Configs::LogicalVolume]
      # @return [Issue, nil]
      def wrong_encryption_method_issue(config)
        method = config.encryption&.method
        return unless method&.only_for_swap?
        return if config.filesystem&.path == Y2Storage::MountPoint::SWAP_PATH.to_s

        error(
          format(
            # TRANSLATORS: 'crypt_method' is the identifier of the method to encrypt the device
            #   (e.g., 'luks1', 'random_swap').
            _("'%{crypt_method}' is not a suitable method to encrypt the device."),
            crypt_method: method.to_human_string
          )
        )
      end

      # Issues from partitions.
      #
      # @param config [Configs::Drive]
      # @return [Array<Issue>]
      def partitions_issues(config)
        config.partitions.flat_map { |p| partition_issues(p) }
      end

      # Issues from a partition config.
      #
      # @param config [Configs::Partition]
      # @return [Array<Issue>]
      def partition_issues(config)
        [
          search_issue(config),
          filesystem_issues(config),
          encryption_issues(config)
        ].flatten.compact
      end

      # Issues from volume groups.
      #
      # @return [Array<Issue>]
      def volume_groups_issues
        [
          overused_physical_volumes_devices_issues,
          config.volume_groups.flat_map { |v| volume_group_issues(v) }
        ].flatten
      end

      # Issues for overused target devices for physical volumes.
      #
      # @note The Agama proposal is not able to calculate if the same target device is used by more
      #   than one volume group having several target devices.
      #
      # @return [Array<Issue>]
      def overused_physical_volumes_devices_issues
        overused = overused_physical_volumes_devices
        return [] if overused.none?

        overused.map do |device|
          error(
            format(
              # TRANSLATORS: %s is the replaced by a device alias (e.g., "disk1").
              _("The device '%s' is used several times as target device for physical volumes"),
              device
            )
          )
        end
      end

      # Aliases of overused target devices for physical volumes.
      #
      # @return [Array<String>]
      def overused_physical_volumes_devices
        config.volume_groups
          .map(&:physical_volumes_devices)
          .map(&:uniq)
          .select { |d| d.size > 1 }
          .flatten
          .tally
          .select { |_, v| v > 1 }
          .keys
      end

      # Issues from a volume group config.
      #
      # @param config [Configs::VolumeGroup]
      # @return [Array<Issue>]
      def volume_group_issues(config)
        [
          logical_volumes_issues(config),
          physical_volumes_issues(config),
          physical_volumes_devices_issues(config),
          physical_volumes_encryption_issues(config)
        ].flatten
      end

      # Issues from a logical volumes.
      #
      # @param config [Configs::VolumeGroup]
      # @return [Array<Issue>]
      def logical_volumes_issues(config)
        config.logical_volumes.flat_map { |v| logical_volume_issues(v, config) }
      end

      # Issues from a logical volume config.
      #
      # @param lv_config [Configs::LogicalVolume]
      # @param vg_config [Configs::VolumeGroup]
      #
      # @return [Array<Issue>]
      def logical_volume_issues(lv_config, vg_config)
        [
          filesystem_issues(lv_config),
          encryption_issues(lv_config),
          missing_thin_pool_issue(lv_config, vg_config)
        ].compact.flatten
      end

      # @see #logical_volume_issues
      #
      # @param lv_config [Configs::LogicalVolume]
      # @param vg_config [Configs::VolumeGroup]
      #
      # @return [Issue, nil]
      def missing_thin_pool_issue(lv_config, vg_config)
        return unless lv_config.thin_volume?

        pool = vg_config.logical_volumes
          .select(&:pool?)
          .find { |p| p.alias == lv_config.used_pool }

        return if pool

        error(
          format(
            # TRANSLATORS: %s is the replaced by a device alias (e.g., "pv1").
            _("There is no LVM thin pool volume with alias '%s'"),
            lv_config.used_pool
          )
        )
      end

      # Issues from physical volumes.
      #
      # @param config [Configs::VolumeGroup]
      # @return [Array<Issue>]
      def physical_volumes_issues(config)
        config.physical_volumes.map { |v| missing_physical_volume_issue(v) }.compact
      end

      # @see #physical_volumes_issues
      #
      # @param pv_alias [String]
      # @return [Issue, nil]
      def missing_physical_volume_issue(pv_alias)
        configs = config.drives + config.drives.flat_map(&:partitions)
        return if configs.any? { |c| c.alias == pv_alias }

        error(
          format(
            # TRANSLATORS: %s is the replaced by a device alias (e.g., "pv1").
            _("There is no LVM physical volume with alias '%s'"),
            pv_alias
          )
        )
      end

      # Issues from physical volumes devices (target devices).
      #
      # @param config [Configs::VolumeGroup]
      # @return [Array<Issue>]
      def physical_volumes_devices_issues(config)
        config.physical_volumes_devices
          .map { |d| missing_physical_volumes_device_issue(d) }
          .compact
      end

      # @see #physical_volumes_devices_issue
      #
      # @param device_alias [String]
      # @return [Issue, nil]
      def missing_physical_volumes_device_issue(device_alias)
        return if config.drives.any? { |d| d.alias == device_alias }

        error(
          format(
            # TRANSLATORS: %s is the replaced by a device alias (e.g., "disk1").
            _("There is no target device for LVM physical volumes with alias '%s'"),
            device_alias
          )
        )
      end

      # Issues from physical volumes encryption.
      #
      # @param config [Configs::VolumeGroup]
      # @return [Array<Issue>]
      def physical_volumes_encryption_issues(config)
        encryption = config.physical_volumes_encryption
        return [] unless encryption

        [
          missing_encryption_password_issue(encryption),
          unavailable_encryption_method_issue(encryption),
          wrong_physical_volumes_encryption_method_issue(encryption)
        ].compact
      end

      # @see #physical_volumes_encryption_issues
      #
      # @param config [Configs::Encryption]
      # @return [Issue, nil]
      def wrong_physical_volumes_encryption_method_issue(config)
        method = config.method
        return if method.nil? || valid_physical_volumes_encryption_method?(method)

        error(
          format(
            # TRANSLATORS: 'crypt_method' is the identifier of the method to encrypt the device
            #   (e.g., 'luks1').
            _("'%{crypt_method}' is not a suitable method to encrypt the physical volumes."),
            crypt_method: method.to_human_string
          )
        )
      end

      # Whether an encryption method can be used for encrypting physical volumes.
      #
      # @param method [Y2Storage::EncryptionMethod]
      # @return [Boolean]
      def valid_physical_volumes_encryption_method?(method)
        valid_methods = [
          Y2Storage::EncryptionMethod::LUKS1,
          Y2Storage::EncryptionMethod::LUKS2,
          Y2Storage::EncryptionMethod::PERVASIVE_LUKS2,
          Y2Storage::EncryptionMethod::TPM_FDE
        ]

        valid_methods.include?(method)
      end

      # Suitable file system types for the given path.
      #
      # @param path [String, nil]
      # @return [Array<Y2Storage::Filesytems::Type>]
      def suitable_filesystem_types(path = nil)
        volume_builder.for(path || "").outline.filesystems
      end

      # @return [VolumeTemplatesBuilder]
      def volume_builder
        @volume_builder ||= VolumeTemplatesBuilder.new_from_config(product_config)
      end

      # Creates a warning issue.
      #
      # @param message [String]
      # @return [Issue]
      def warning(message)
        Agama::Issue.new(
          message,
          source:   Agama::Issue::Source::CONFIG,
          severity: Agama::Issue::Severity::WARN
        )
      end

      # Creates an error issue.
      #
      # @param message [String]
      # @return [Issue]
      def error(message)
        Agama::Issue.new(
          message,
          source:   Agama::Issue::Source::CONFIG,
          severity: Agama::Issue::Severity::ERROR
        )
      end
    end
  end
end
