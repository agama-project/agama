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
            devices_size_issue
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
            kind: :no_such_alias
          )
        end

        # Issue if the MD RAID level is missing.
        #
        # @return [Issue, nil]
        def level_issue
          return if config.search && !config.search.create_device?
          return if config.level

          error(format(_("There is a MD RAID without level")), kind: :md_raid)
        end

        # Issue if the MD RAID does not contain enough member devices.
        #
        # @return [Issue, nil]
        def devices_size_issue
          return unless config.level
          return if used_devices.size >= config.min_devices

          error(
            format(_("At least %s devices are required for %s"), config.min_devices, config.level),
            kind: :md_raid
          )
        end

        # Devices used as MD RAID member devices.
        #
        # @return [Array<Configs::Drive, Configs::Partition>]
        def used_devices
          storage_config.potential_for_md_device
            .select { |d| config.devices.include?(d.alias) }
        end
      end
    end
  end
end
