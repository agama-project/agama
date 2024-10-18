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

require "agama/storage/config"
require "agama/storage/config_conversions/to_json_conversions/base"
require "agama/storage/config_conversions/to_json_conversions/boot"
require "agama/storage/config_conversions/to_json_conversions/drive"
require "agama/storage/config_conversions/to_json_conversions/volume_group"

module Agama
  module Storage
    module ConfigConversions
      module ToJSONConversions
        # Config conversion to JSON hash according to schema.
        class Config < Base
          # @see Base
          def self.config_type
            Storage::Config
          end

        private

          # @see Base#conversions
          def conversions
            {
              boot:         convert_boot,
              drives:       convert_drives,
              volumeGroups: convert_volume_groups
            }
          end

          # @return [Hash]
          def convert_boot
            ToJSONConversions::Boot.new(config.boot).convert
          end

          # @return [Array<Hash>]
          def convert_drives
            config.drives.map { |d| ToJSONConversions::Drive.new(d).convert }
          end

          # @return [Array<Hash>]
          def convert_volume_groups
            config.volume_groups.map { |v| ToJSONConversions::VolumeGroup.new(v).convert }
          end
        end
      end
    end
  end
end
