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

require "agama/storage/config_checkers/base"
require "agama/storage/config_checkers/logical_volume"
require "agama/storage/config_checkers/physical_volumes_encryption"
require "yast/i18n"

module Agama
  module Storage
    module ConfigCheckers
      # Class for checking a volume group config.
      class VolumeGroup < Base
        include Yast::I18n

        # @param config [Configs::VolumeGroup]
        # @param storage_config [Storage::Config]
        # @param product_config [Agama::Config]
        def initialize(config, storage_config, product_config)
          super(storage_config, product_config)

          textdomain "agama"
          @config = config
        end

        # Issues from a volume group config.
        #
        # @return [Array<Issue>]
        def issues
          [
            name_issue,
            logical_volumes_issues,
            physical_volumes_issues,
            physical_volumes_devices_issues,
            physical_volumes_encryption_issues
          ].compact.flatten
        end

      private

        # @return [Configs::VolumeGroup]
        attr_reader :config

        # Issue if the volume group name is missing.
        #
        # @return [Issue, nil]
        def name_issue
          return if config.name && !config.name.empty?

          error(_("There is a volume group without name"))
        end

        # Issues from logical volumes.
        #
        # @return [Array<Issue>]
        def logical_volumes_issues
          config.logical_volumes.flat_map do |logical_volume|
            ConfigCheckers::LogicalVolume
              .new(logical_volume, config, storage_config, product_config)
              .issues
          end
        end

        # Issues from physical volumes.
        #
        # @return [Array<Issue>]
        def physical_volumes_issues
          config.physical_volumes.map { |v| missing_physical_volume_issue(v) }.compact
        end

        # @see #physical_volumes_issues
        #
        # @param pv_alias [String]
        # @return [Issue, nil]
        def missing_physical_volume_issue(pv_alias)
          return if storage_config.potential_for_pv.any? { |c| c.alias == pv_alias }

          error(
            # TRANSLATORS: %s is the replaced by a device alias (e.g., "pv1").
            format(_("There is no LVM physical volume with alias '%s'"), pv_alias),
            kind: :no_such_alias
          )
        end

        # Issues from physical volumes devices (target devices).
        #
        # @return [Array<Issue>]
        def physical_volumes_devices_issues
          config.physical_volumes_devices
            .map { |d| missing_physical_volumes_device_issue(d) }
            .compact
        end

        # @see #physical_volumes_devices_issue
        #
        # @param device_alias [String]
        # @return [Issue, nil]
        def missing_physical_volumes_device_issue(device_alias)
          return if storage_config.potential_for_pv_device.any? { |d| d.alias == device_alias }

          error(
            format(
              # TRANSLATORS: %s is the replaced by a device alias (e.g., "disk1").
              _("There is no target device for LVM physical volumes with alias '%s'"),
              device_alias
            ),
            kind: :no_such_alias
          )
        end

        # Issues from physical volumes encryption.
        #
        # @return [Array<Issue>]
        def physical_volumes_encryption_issues
          ConfigCheckers::PhysicalVolumesEncryption
            .new(config, storage_config, product_config)
            .issues
        end
      end
    end
  end
end
