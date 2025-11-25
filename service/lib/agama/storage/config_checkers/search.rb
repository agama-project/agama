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
require "agama/storage/configs/drive"
require "agama/storage/configs/logical_volume"
require "agama/storage/configs/md_raid"
require "agama/storage/configs/partition"
require "yast/i18n"

module Agama
  module Storage
    module ConfigCheckers
      # Class for checking the search config.
      class Search < Base
        include Yast::I18n

        # @param config [#search]
        def initialize(config)
          super()

          textdomain "agama"
          @config = config
        end

        # Search config issues.
        #
        # @return [Array<Issue>]
        def issues
          return [] unless search

          [not_found_issue].compact
        end

      private

        # @return [#search]
        attr_reader :config

        # @return [Configs::Search, nil]
        def search
          config.search
        end

        # @see Base
        def error(message)
          super(message, kind: IssueClasses::Config::SEARCH)
        end

        # @return [Issue, nil]
        def not_found_issue
          return if search.device || search.skip_device?

          if search.name
            # TRANSLATORS: %s is replaced by a device name (e.g., "/dev/vda").
            error(format(_("Mandatory device %s not found"), search.name))
          else
            # TRANSLATORS: %s is replaced by a device type (e.g., "drive").
            error(format(_("Mandatory %s not found"), device_type))
          end
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
          else
            _("device")
          end
        end
      end
    end
  end
end
