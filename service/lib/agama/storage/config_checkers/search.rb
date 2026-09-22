# frozen_string_literal: true

# Copyright (c) [2024-2026] SUSE LLC
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
require "agama/storage/configs/drive"
require "agama/storage/configs/logical_volume"
require "agama/storage/configs/md_raid"
require "agama/storage/configs/partition"
require "agama/storage/configs/volume_group"
require "agama/storage/issue_classes"
require "yast/i18n"

module Agama
  module Storage
    module ConfigCheckers
      # Class for checking the search config.
      class Search < Base
        include Yast::I18n

        # @param config [#search]
        # @param storage_config [Storage::Config]
        def initialize(config, storage_config)
          super()

          textdomain "agama"
          @config = config
          @storage_config = storage_config
        end

        # Search config issues.
        #
        # @return [Array<Issue>]
        def issues
          return [] unless config.search

          [
            not_found_issue,
            reused_issues
          ].flatten.compact
        end

      private

        # @return [#search]
        attr_reader :config

        # @return [Storage::Config]
        attr_reader :storage_config

        # @return [Issue, nil]
        def not_found_issue
          search = config.search
          return if search.device || search.create_device? || search.skip_device?

          name = search.condition_name
          if name
            error(
              # TRANSLATORS: %s is replaced by a device name (e.g., "/dev/vda").
              format(_("Mandatory device %s not found"), name),
              kind: IssueClasses::Config::SEARCH_NOT_FOUND
            )
          else
            error(
              # TRANSLATORS: %s is replaced by a device type (e.g., "drive").
              format(_("Mandatory %s not found"), device_type),
              kind: IssueClasses::Config::SEARCH_NOT_FOUND
            )
          end
        end

        # Issues from a reused device.
        #
        # When a MD RAID or LVM volume group is reused, the members of the device (i.e., MD devices
        # or physical volume) must be kept. Otherwise the reused device will be deleted.
        #
        # @return [Array<Issue>]
        def reused_issues
          reused_members.map { |m| reused_member_issue(m) }.compact
        end

        # Issue if the member device is used for any other purpose.
        #
        # @param member [Y2Storage::BlkDevice] Member device.
        # @return [Issue, nil]
        def reused_member_issue(member)
          member_config = storage_config.find_device(member)
          return parent_reused_member_issue(member) unless member_config

          deleted_reused_member_issue(member_config) ||
            resized_reused_member_issue(member_config) ||
            formatted_reused_member_issue(member_config) ||
            partitioned_reused_member_issue(member_config) ||
            target_reused_member_issue(member_config)
        end

        # Issue if the parent of the member device is formatted.
        #
        # @param device [Y2Storage::BlkDevice] Parent of the member device.
        # @return [Issue, nil]
        def parent_reused_member_issue(device)
          return unless device.respond_to?(:partitionable)

          parent_config = storage_config.find_device(device.partitionable)
          return unless parent_config&.filesystem

          kind, message = if config.is_a?(Agama::Storage::Configs::MdRaid)
            [
              IssueClasses::Config::MISUSED_MD_MEMBER,
              _(
                # TRANSLATORS: %{parent_name} and %{reused_name} are replaced by device names (e.g.,
                # "/dev/vda", "/dev/md0").
                "The device '%{parent_name}' cannot be formatted because it is part of the " \
                "reused MD RAID '%{reused_name}'"
              )
            ]
          else
            [
              IssueClasses::Config::MISUSED_PV,
              _(
                # TRANSLATORS: %{parent_name} and %{reused_name} are replaced by device names (e.g.,
                # "/dev/vda", "/dev/vg0").
                "The device '%{parent_name}' cannot be formatted because it is a physical volume " \
                "of the reused LVM volume group '%{reused_name}'"
              )
            ]
          end

          error(
            format(
              message,
              parent_name: parent_config.found_device.name,
              reused_name: config.found_device.name
            ),
            kind: kind
          )
        end

        # Issue if the member device is deleted.
        #
        # @param member_config [#search]
        # @return [Issue, nil]
        def deleted_reused_member_issue(member_config)
          return unless storage_config.supporting_delete.include?(member_config)
          return unless member_config.delete? || member_config.delete_if_needed?

          kind, message = if config.is_a?(Agama::Storage::Configs::MdRaid)
            [
              IssueClasses::Config::MISUSED_MD_MEMBER,
              _(
                # TRANSLATORS: %{member_name} and %{reused_name} are replaced by device names (e.g.,
                # "/dev/vda", "/dev/md0").
                "The device '%{member_name}' cannot be deleted because it is part of the reused " \
                "MD RAID '%{reused_name}'"
              )
            ]
          else
            [
              IssueClasses::Config::MISUSED_PV,
              _(
                # TRANSLATORS: %{member_name} and %{reused_name} are replaced by device names (e.g.,
                # "/dev/vda", "/dev/vg0").
                "The device '%{member_name}' cannot be deleted because it is a physical volume " \
                "of the reused LVM volume group '%{reused_name}'"
              )
            ]
          end

          error(
            format(
              message,
              member_name: member_config.found_device.name,
              reused_name: config.found_device.name
            ),
            kind: kind
          )
        end

        # Issue if the device member is resized.
        #
        # @param member_config [#search]
        # @return [Issue, nil]
        def resized_reused_member_issue(member_config)
          return unless storage_config.supporting_size.include?(member_config)
          return if member_config.size.default?

          kind, message = if config.is_a?(Agama::Storage::Configs::MdRaid)
            [
              IssueClasses::Config::MISUSED_MD_MEMBER,
              _(
                # TRANSLATORS: %{member_name} and %{reused_name} are replaced by device names (e.g.,
                # "/dev/vda", "/dev/md0").
                "The device '%{member_name}' cannot be resized because it is part of the reused " \
                "MD RAID '%{reused_name}'"
              )
            ]
          else
            [
              IssueClasses::Config::MISUSED_PV,
              _(
                # TRANSLATORS: %{member_name} and %{reused_name} are replaced by device names (e.g.,
                # "/dev/vda", "/dev/vg0").
                "The device '%{member_name}' cannot be resized because it is a physical volume " \
                "of the reused LVM volume group '%{reused_name}'"
              )
            ]
          end

          error(
            format(
              message,
              member_name: member_config.found_device.name,
              reused_name: config.found_device.name
            ),
            kind: kind
          )
        end

        # Issue if the device member is formatted.
        #
        # @param member_config [#search]
        # @return [Issue, nil]
        def formatted_reused_member_issue(member_config)
          return unless storage_config.supporting_filesystem.include?(member_config)
          return unless member_config.filesystem

          kind, message = if config.is_a?(Agama::Storage::Configs::MdRaid)
            [
              IssueClasses::Config::MISUSED_MD_MEMBER,
              _(
                # TRANSLATORS: %{member_name} and %{reused_name} are replaced by device names (e.g.,
                # "/dev/vda", "/dev/md0").
                "The device '%{member_name}' cannot be formatted because it is part of the " \
                "reused MD RAID '%{reused_name}'"
              )
            ]
          else
            [
              IssueClasses::Config::MISUSED_PV,
              _(
                # TRANSLATORS: %{member_name} and %{reused_name} are replaced by device names (e.g.,
                # "/dev/vda", "/dev/vg0").
                "The device '%{member_name}' cannot be formatted because it is a physical volume " \
                "of the reused LVM volume group '%{reused_name}'"
              )
            ]
          end

          error(
            format(
              message,
              member_name: member_config.found_device.name,
              reused_name: config.found_device.name
            ),
            kind: kind
          )
        end

        # Issue if the device member is partitioned.
        #
        # @param member_config [#search]
        # @return [Issue, nil]
        def partitioned_reused_member_issue(member_config)
          return unless storage_config.supporting_partitions.include?(member_config)
          return unless member_config.partitions?

          kind, message = if config.is_a?(Agama::Storage::Configs::MdRaid)
            [
              IssueClasses::Config::MISUSED_MD_MEMBER,
              _(
                # TRANSLATORS: %{member_name} and %{reused_name} are replaced by device names (e.g.,
                # "/dev/vda", "/dev/md0").
                "The device '%{member_name}' cannot be partitioned because it is part of the " \
                "reused MD RAID '%{reused_name}'"
              )
            ]
          else
            [
              IssueClasses::Config::MISUSED_PV,
              _(
                # TRANSLATORS: %{member_name} and %{reused_name} are replaced by device names (e.g.,
                # "/dev/vda", "/dev/vg0").
                "The device '%{member_name}' cannot be partitioned because it is a physical " \
                "volume of the reused LVM volume group '%{reused_name}'"
              )
            ]
          end

          error(
            format(
              message,
              member_name: member_config.found_device.name,
              reused_name: config.found_device.name
            ),
            kind: kind
          )
        end

        # Issue if the device member is used by other device (e.g., as target for physical volumes).
        #
        # @param member_config [#search]
        # @return [Issue, nil]
        def target_reused_member_issue(member_config)
          return unless users?(member_config)

          kind, message = if config.is_a?(Agama::Storage::Configs::MdRaid)
            [
              IssueClasses::Config::MISUSED_MD_MEMBER,
              _(
                # TRANSLATORS: %{member_name} and %{reused_name} are replaced by device names (e.g.,
                # "/dev/vda", "/dev/md0").
                "The device '%{member_name}' cannot be used because it is part of the reused " \
                "MD RAID '%{reused_name}'"
              )
            ]
          else
            [
              IssueClasses::Config::MISUSED_PV,
              _(
                # TRANSLATORS: %{member_name} and %{reused_name} are replaced by device names (e.g.,
                # "/dev/vda", "/dev/vg0").
                "The device '%{member_name}' cannot be used because it is a physical volume " \
                "of the reused LVM volume group '%{reused_name}'"
              )
            ]
          end

          error(
            format(
              message,
              member_name: member_config.found_device.name,
              reused_name: config.found_device.name
            ),
            kind: kind
          )
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

        # Members of the device reused by the config.
        #
        # @return [Array<Y2Storage::BlkDevice>]
        def reused_members
          device = config.found_device
          return [] unless device

          return device.lvm_pvs.map(&:plain_blk_device) if device.is?(:lvm_vg)

          return device.plain_devices if device.is?(:md)

          []
        end

        # @return [String]
        def device_type
          case config
          when Agama::Storage::Configs::Drive
            _("drive")
          when Agama::Storage::Configs::MdRaid
            _("MD RAID")
          when Agama::Storage::Configs::Partition
            _("partition")
          when Agama::Storage::Configs::LogicalVolume
            _("LVM logical volume")
          when Agama::Storage::Configs::VolumeGroup
            _("LVM volume group")
          else
            _("device")
          end
        end
      end
    end
  end
end
