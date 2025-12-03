# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require "agama/storage/config_checkers/base"
require "agama/storage/config_checkers/with_alias"
require "agama/storage/config_checkers/with_encryption"
require "agama/storage/config_checkers/with_filesystem"
require "agama/storage/config_checkers/with_partitions"
require "agama/storage/config_checkers/with_search"
require "yast/i18n"

module Agama
  module Storage
    module ConfigCheckers
      # Class for checking a MD RAID config.
      class MdRaid < Base
        include Yast::I18n
        include WithAlias
        include WithEncryption
        include WithFilesystem
        include WithPartitions
        include WithSearch

        # @param config [Configs::MdRaid]
        # @param storage_config [Storage::Config]
        # @param product_config [Agama::Config]
        def initialize(config, storage_config, product_config)
          super()

          textdomain "agama"
          @config = config
          @storage_config = storage_config
          @product_config = product_config
        end

        # MD RAID config issues.
        #
        # @return [Array<Issue>]
        def issues
          [
            alias_issues,
            search_issues,
            filesystem_issues,
            encryption_issues,
            partitions_issues,
            devices_issues,
            level_issue,
            devices_size_issue,
            reused_member_issues
          ].flatten.compact
        end

      private

        # @return [Configs::MdRaid]
        attr_reader :config

        # @return [Storage::Config]
        attr_reader :storage_config

        # @return [Agama::Config]
        attr_reader :product_config

        # Issues from MD RAID member devices.
        #
        # @return [Array<Issue>]
        def devices_issues
          config.devices.map { |d| missing_device_issue(d) }.compact
        end

        # @see #devices_issues
        #
        # @param device_alias [String]
        # @return [Issue, nil]
        def missing_device_issue(device_alias)
          return if storage_config.potential_for_md_device.any? { |d| d.alias?(device_alias) }

          error(
            # TRANSLATORS: %s is the replaced by a device alias (e.g., "md1").
            format(_("There is no MD RAID member device with alias '%s'"), device_alias),
            kind: IssueClasses::Config::NO_SUCH_ALIAS
          )
        end

        # Issue if the MD RAID level is missing and the device is not reused.
        #
        # @return [Issue, nil]
        def level_issue
          return if config.level
          return unless config.create?

          error(
            format(_("There is a MD RAID without level")),
            kind: IssueClasses::Config::NO_RAID_LEVEL
          )
        end

        # Issue if the MD RAID does not contain enough member devices.
        #
        # @return [Issue, nil]
        def devices_size_issue
          return unless config.level
          return if used_devices.size >= config.min_devices

          error(
            format(_("At least %s devices are required for %s"), config.min_devices, config.level),
            kind: IssueClasses::Config::WRONG_RAID_MEMBERS
          )
        end

        # Devices used as MD RAID member devices.
        #
        # @return [Array<Configs::Drive, Configs::Partition>]
        def used_devices
          storage_config.potential_for_md_device
            .select { |d| config.devices.include?(d.alias) }
        end

        # Issues from the member devices of a reused MD RAID.
        #
        # @return [Array<Issue>]
        def reused_member_issues
          return [] unless config.found_device

          config.found_device.devices.map { |d| reused_member_issue(d) }
        end

        # Issue from the member devices of a reused MD RAID.
        #
        # @param device [Y2Storage::BlkDevice]
        # @return [Issue, nil]
        def reused_member_issue(device)
          member_config = find_config(device)
          return parent_reused_member_issue(device) unless member_config

          deleted_reused_member_issue(member_config) ||
            resized_reused_member_issue(member_config) ||
            formatted_reused_member_issue(member_config) ||
            partitioned_reused_member_issue(member_config) ||
            target_reused_member_issue(member_config)
        end

        # Issue if the device member is deleted.
        #
        # @param member_config [#search]
        # @return [Issue, nil]
        def deleted_reused_member_issue(member_config)
          return unless storage_config.supporting_delete.include?(member_config)
          return unless member_config.delete? || member_config.delete_if_needed?

          error(
            format(
              _(
                # TRANSLATORS: %{member} is replaced by a device name (e.g., "/dev/vda") and
                #   %{md_raid} is replaced by a MD RAID name (e.g., "/dev/md0").
                "The device '%{member}' cannot be deleted because it is part of the MD RAID " \
                "%{md_raid}"
              ),
              member:  member_config.found_device.name,
              md_raid: config.found_device.name
            ),
            kind: IssueClasses::Config::MISUSED_MD_MEMBER
          )
        end

        # Issue if the device member is resized.
        #
        # @param member_config [#search]
        # @return [Issue, nil]
        def resized_reused_member_issue(member_config)
          return unless storage_config.supporting_size.include?(member_config)
          return if member_config.size.default?

          error(
            format(
              _(
                # TRANSLATORS: %{member} is replaced by a device name (e.g., "/dev/vda") and
                #   %{md_raid} is replaced by a MD RAID name (e.g., "/dev/md0").
                "The device '%{member}' cannot be resized because it is part of the MD RAID " \
                "%{md_raid}"
              ),
              member:  member_config.found_device.name,
              md_raid: config.found_device.name
            ),
            kind: IssueClasses::Config::MISUSED_MD_MEMBER
          )
        end

        # Issue if the device member is formatted.
        #
        # @param member_config [#search]
        # @return [Issue, nil]
        def formatted_reused_member_issue(member_config)
          return unless storage_config.supporting_filesystem.include?(member_config)
          return unless member_config.filesystem

          error(
            format(
              _(
                # TRANSLATORS: %{member} is replaced by a device name (e.g., "/dev/vda") and
                #   %{md_raid} is replaced by a MD RAID name (e.g., "/dev/md0").
                "The device '%{member}' cannot be formatted because it is part of the MD RAID " \
                "%{md_raid}"
              ),
              member:  member_config.found_device.name,
              md_raid: config.found_device.name
            ),
            kind: IssueClasses::Config::MISUSED_MD_MEMBER
          )
        end

        # Issue if the device member is partitioned.
        #
        # @param member_config [#search]
        # @return [Issue, nil]
        def partitioned_reused_member_issue(member_config)
          return unless storage_config.supporting_partitions.include?(member_config)
          return unless member_config.partitions?

          error(
            format(
              _(
                # TRANSLATORS: %{member} is replaced by a device name (e.g., "/dev/vda") and
                #   %{md_raid} is replaced by a MD RAID name (e.g., "/dev/md0").
                "The device '%{member}' cannot be partitioned because it is part of the MD RAID " \
                "%{md_raid}"
              ),
              member:  member_config.found_device.name,
              md_raid: config.found_device.name
            ),
            kind: IssueClasses::Config::MISUSED_MD_MEMBER
          )
        end

        # Issue if the device member is used by other device (e.g., as target for physical volumes).
        #
        # @param member_config [#search]
        # @return [Issue, nil]
        def target_reused_member_issue(member_config)
          return unless users?(member_config)

          error(
            format(
              _(
                # TRANSLATORS: %{member} is replaced by a device name (e.g., "/dev/vda") and
                #   %{md_raid} is replaced by a MD RAID name (e.g., "/dev/md0").
                "The device '%{member}' cannot be used because it is part of the MD RAID " \
                "%{md_raid}"
              ),
              member:  member_config.found_device.name,
              md_raid: config.found_device.name
            ),
            kind: IssueClasses::Config::MISUSED_MD_MEMBER
          )
        end

        # Issue if the parent of the device member is formatted.
        #
        # @param device [Y2Storage::BlkDevice]
        # @return [Issue, nil]
        def parent_reused_member_issue(device)
          return unless device.respond_to?(:partitionable)

          parent_config = find_config(device.partitionable)
          return unless parent_config&.filesystem

          error(
            format(
              _(
                # TRANSLATORS: %{device} is replaced by a device name (e.g., "/dev/vda") and
                #   %{md_raid} is replaced by a MD RAID name (e.g., "/dev/md0").
                "The device '%{device}' cannot be formatted because it is part of the MD RAID " \
                "%{md_raid}"
              ),
              device:  parent_config.found_device.name,
              md_raid: config.found_device.name
            ),
            kind: IssueClasses::Config::MISUSED_MD_MEMBER
          )
        end

        # Finds the config assigned to the given device.
        #
        # @param device [Y2Storage::BlkDevice]
        # @return [#search]
        def find_config(device)
          storage_config.supporting_search.find { |c| c.found_device == device }
        end

        # Whether the given config has any user (direct user or as target).
        #
        # @param config [#search]
        # @return [Boolean]
        def users?(config)
          return false unless config.alias

          storage_config.users(config.alias).any? ||
            storage_config.target_users(config.alias).any?
        end
      end
    end
  end
end
