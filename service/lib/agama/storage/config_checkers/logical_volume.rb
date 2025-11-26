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
require "agama/storage/config_checkers/with_encryption"
require "agama/storage/config_checkers/with_filesystem"
require "yast/i18n"

module Agama
  module Storage
    module ConfigCheckers
      # Class for checking a logical volume config.
      class LogicalVolume < Base
        include Yast::I18n
        include WithEncryption
        include WithFilesystem

        # @param config [Configs::LogicalVolume]
        # @param volume_group_config [Configs::VolumeGroup]
        # @param product_config [Agama::Config]
        def initialize(config, volume_group_config, product_config)
          super()

          textdomain "agama"
          @config = config
          @volume_group_config = volume_group_config
          @product_config = product_config
        end

        # Logical volume config issues.
        #
        # @return [Array<Issue>]
        def issues
          [
            filesystem_issues,
            encryption_issues,
            missing_thin_pool_issue
          ].compact.flatten
        end

      private

        # @return [Configs::LogicalVolue]
        attr_reader :config

        # @return [Configs::VolumeGroup]
        attr_reader :volume_group_config

        # @return [Agama::Config]
        attr_reader :product_config

        # @return [Issue, nil]
        def missing_thin_pool_issue
          return unless config.thin_volume?

          pool = volume_group_config.logical_volumes
            .select(&:pool?)
            .find { |p| p.alias == config.used_pool }

          return if pool

          error(
            # TRANSLATORS: %s is the replaced by a device alias (e.g., "pv1").
            format(_("There is no LVM thin pool volume with alias '%s'"), config.used_pool),
            kind: IssueClasses::Config::ALIAS
          )
        end
      end
    end
  end
end
