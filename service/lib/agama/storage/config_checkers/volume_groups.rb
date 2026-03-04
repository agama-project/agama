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
require "yast/i18n"

module Agama
  module Storage
    module ConfigCheckers
      # Class for checking the volume groups.
      class VolumeGroups < Base
        include Yast::I18n

        # @param storage_config [Storage::Config]
        def initialize(storage_config)
          super()

          textdomain "agama"
          @storage_config = storage_config
        end

        # Volume groups issues.
        #
        # @return [Array<Issue>]
        def issues
          overused_physical_volumes_devices_issues
        end

      private

        # @return [Storage::Config]
        attr_reader :storage_config

        # Issues for overused target devices for physical volumes.
        #
        # @note The Agama proposal is not able to calculate if the same target device is used by
        #   more than one volume group having several target devices.
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
              ),
              kind: IssueClasses::Config::OVERUSED_PV_TARGET
            )
          end
        end

        # Aliases of overused target devices for physical volumes.
        #
        # @return [Array<String>]
        def overused_physical_volumes_devices
          storage_config.volume_groups
            .map(&:physical_volumes_devices)
            .map(&:uniq)
            .select { |d| d.size > 1 }
            .flatten
            .tally
            .select { |_, v| v > 1 }
            .keys
        end
      end
    end
  end
end
