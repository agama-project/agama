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

require "agama/config"
require "agama/storage/config_checkers/boot"
require "agama/storage/config_checkers/filesystems"
require "agama/storage/config_checkers/drive"
require "agama/storage/config_checkers/md_raid"
require "agama/storage/config_checkers/volume_group"
require "agama/storage/config_checkers/volume_groups"

module Agama
  module Storage
    # Class for checking a storage config.
    class ConfigChecker
      # @param storage_config [Storage::Config]
      # @param product_config [Agama::Config, nil]
      def initialize(storage_config, product_config = nil)
        @storage_config = storage_config
        @product_config = product_config || Agama::Config.new
      end

      # Issues detected in the config.
      #
      # @return [Array<Issue>]
      def issues
        [
          filesystems_issues,
          boot_issues,
          drives_issues,
          md_raids_issues,
          volume_groups_issues
        ].flatten
      end

    private

      # @return [Storage::Config]
      attr_reader :storage_config

      # @return [Agama::Config]
      attr_reader :product_config

      # Issues from boot config.
      #
      # @return [Array<Issue>]
      def boot_issues
        ConfigCheckers::Boot.new(storage_config).issues
      end

      # Issues related to the list of filesystems (mount paths)
      #
      # @return [Array<Issue>]
      def filesystems_issues
        ConfigCheckers::Filesystems.new(storage_config, product_config).issues
      end

      # Issues from drives.
      #
      # @return [Array<Issue>]
      def drives_issues
        storage_config.drives.flat_map { |d| drive_issues(d) }
      end

      # @param config [Configs::Drive]
      # @return [Array<Issue>]
      def drive_issues(config)
        ConfigCheckers::Drive.new(config, product_config).issues
      end

      # Issues from MD RAIDs.
      #
      # @return [Array<Issue>]
      def md_raids_issues
        storage_config.md_raids.flat_map { |m| md_raid_issues(m) }
      end

      # @param config [Configs::MdRaid]
      # @return [Array<Issue>]
      def md_raid_issues(config)
        ConfigCheckers::MdRaid.new(config, storage_config, product_config).issues
      end

      # @return [Array<Issue>]
      def volume_groups_issues
        section_issues = ConfigCheckers::VolumeGroups.new(storage_config).issues
        issues = storage_config.volume_groups.flat_map { |v| volume_group_issues(v) }

        [
          section_issues,
          issues
        ].flatten
      end

      # @param config [Configs::VolumeGroup]
      # @return [Array<Issue>]
      def volume_group_issues(config)
        ConfigCheckers::VolumeGroup.new(config, storage_config, product_config).issues
      end
    end
  end
end
