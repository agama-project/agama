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
require "yast/i18n"
require "y2storage/mount_point"

module Agama
  module Storage
    # Class for checking a storage config.
    class ConfigChecker
      include Yast::I18n

      # @param config [Storage::Config]
      def initialize(config)
        textdomain "agama"
        @config = config
      end

      # Issues detected in the config.
      #
      # @return [Array<Issue>]
      def issues
        config.drives.flat_map { |d| drive_issues(d) } +
          config.volume_groups.flat_map { |v| volume_group_issues(v) }
      end

    private

      # @return [Storage::Config]
      attr_reader :config

      # Issues from a drive config.
      #
      # @param config [Configs::Drive]
      # @return [Array<Issue>]
      def drive_issues(config)
        issues = encryption_issues(config)
        partitions_issues = config.partitions.flat_map { |p| partition_issues(p) }

        issues + partitions_issues
      end

      # Issues from a partition config.
      #
      # @param config [Configs::Partition]
      # @return [Array<Issue>]
      def partition_issues(config)
        encryption_issues(config)
      end

      # Issues from a volume group config.
      #
      # @param config [Configs::VolumeGroup]
      # @return [Array<Issue>]
      def volume_group_issues(config)
        lvs_issues = config.logical_volumes.flat_map { |v| logical_volume_issues(v, config) }
        pvs_issues = config.physical_volumes.map { |v| missing_physical_volume_issue(v) }.compact

        lvs_issues + pvs_issues
      end

      # Issues from a logical volume config.
      #
      # @param lv_config [Configs::LogicalVolume]
      # @param vg_config [Configs::VolumeGroup]
      #
      # @return [Array<Issue>]
      def logical_volume_issues(lv_config, vg_config)
        [
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
            _("There is no LVM thin pool volume with alias %s"),
            lv_config.used_pool
          )
        )
      end

      # @see #logical_volume_issues
      #
      # @param pv_alias [String]
      # @return [Issue, nil]
      def missing_physical_volume_issue(pv_alias)
        configs = config.drives + config.drives.flat_map(&:partitions)
        return if configs.any? { |c| c.alias == pv_alias }

        error(
          format(
            # TRANSLATORS: %s is the replaced by a device alias (e.g., "pv1").
            _("There is no LVM physical volume with alias %s"),
            pv_alias
          )
        )
      end

      # Issues related to encryption.
      #
      # @param config [Configs::Drive, Configs::Partition, Configs::LogicalVolume]
      # @return [Array<Issue>]
      def encryption_issues(config)
        return [] unless config.encryption

        [
          missing_encryption_password_issue(config),
          available_encryption_method_issue(config),
          wrong_encryption_method_issue(config)
        ].compact
      end

      # @see #encryption_issues
      #
      # @param config [Configs::Drive, Configs::Partition, Configs::LogicalVolume]
      # @return [Issue, nil]
      def missing_encryption_password_issue(config)
        return unless config.encryption&.missing_password?

        error(
          format(
            # TRANSLATORS: 'crypt_method' is the identifier of the method to encrypt the device
            #   (e.g., 'luks1', 'random_swap').
            _("No passphrase provided (required for using the method '%{crypt_method}')."),
            crypt_method: config.encryption.method.id.to_s
          )
        )
      end

      # @see #encryption_issues
      #
      # @param config [Configs::Drive, Configs::Partition, Configs::LogicalVolume]
      # @return [Issue, nil]
      def available_encryption_method_issue(config)
        method = config.encryption&.method
        return if !method || method.available?

        error(
          format(
            # TRANSLATORS: 'crypt_method' is the identifier of the method to encrypt the device
            #   (e.g., 'luks1', 'random_swap').
            _("Encryption method '%{crypt_method}' is not available in this system."),
            crypt_method: method.id.to_s
          )
        )
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
            crypt_method: method.id.to_s
          )
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
