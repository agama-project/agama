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

require "agama/storage/config_conversions/from_json_conversions/base"
require "agama/storage/config_conversions/from_json_conversions/boot"
require "agama/storage/config_conversions/from_json_conversions/drive"
require "agama/storage/config_conversions/from_json_conversions/md_raid"
require "agama/storage/config_conversions/from_json_conversions/volume_group"
require "agama/storage/config"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Config conversion from JSON hash according to schema.
        class Config < Base
        private

          # @see Base
          # @return [Config]
          def default_config
            Storage::Config.new
          end

          # @see Base#conversions
          # @return [Hash]
          def conversions
            {
              boot:          convert_boot,
              drives:        convert_drives,
              volume_groups: convert_volume_groups,
              md_raids:      convert_md_raids
            }
          end

          # @return [Configs::Boot, nil]
          def convert_boot
            boot_json = config_json[:boot]
            return unless boot_json

            FromJSONConversions::Boot.new(boot_json).convert
          end

          # @return [Array<Configs::Drive>, nil]
          def convert_drives
            drives_json = config_json[:drives]
            return unless drives_json

            drives_json.map { |d| convert_drive(d) }
          end

          # @param drive_json [Hash]
          # @return [Configs::Drive]
          def convert_drive(drive_json)
            FromJSONConversions::Drive.new(drive_json).convert
          end

          # @return [Array<Configs::VolumeGroup>, nil]
          def convert_volume_groups
            volume_groups_json = config_json[:volumeGroups]
            return unless volume_groups_json

            volume_groups_json.map { |v| convert_volume_group(v) }
          end

          # @param volume_group_json [Hash]
          # @return [Configs::VolumeGroup]
          def convert_volume_group(volume_group_json)
            FromJSONConversions::VolumeGroup.new(volume_group_json).convert
          end

          # @return [Array<Configs::MdRaid>, nil]
          def convert_md_raids
            md_raids_json = config_json[:mdRaids]
            return unless md_raids_json

            md_raids_json.map { |m| convert_md_raid(m) }
          end

          # @param md_raid_json [Hash]
          # @return [Configs::MdRaid]
          def convert_md_raid(md_raid_json)
            FromJSONConversions::MdRaid.new(md_raid_json).convert
          end
        end
      end
    end
  end
end
