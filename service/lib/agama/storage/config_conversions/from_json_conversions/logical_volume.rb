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

require "agama/storage/config_conversions/from_json_conversions/base"
require "agama/storage/config_conversions/from_json_conversions/with_encryption"
require "agama/storage/config_conversions/from_json_conversions/with_filesystem"
require "agama/storage/config_conversions/from_json_conversions/with_size"
require "agama/storage/configs/logical_volume"
require "y2storage/disk_size"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Logical volume conversion from JSON hash according to schema.
        class LogicalVolume < Base
          include WithEncryption
          include WithFilesystem
          include WithSize

          # @param logical_volume_json [Hash]
          # @param config_builder [ConfigBuilder, nil]
          def initialize(logical_volume_json, config_builder: nil)
            super(config_builder)
            @logical_volume_json = logical_volume_json
          end

          # @see Base#convert
          #
          # @param default [Configs::LogicalVolume, nil]
          # @return [Configs::LogicalVolume]
          def convert(default = nil)
            super(default || Configs::LogicalVolume.new)
          end

        private

          # @return [Hash]
          attr_reader :logical_volume_json

          # @see Base#conversions
          #
          # @param default [Configs::LogicalVolume]
          # @return [Hash]
          def conversions(default)
            {
              alias:       logical_volume_json[:alias],
              encryption:  convert_encryption(logical_volume_json, default: default.encryption),
              filesystem:  convert_filesystem(logical_volume_json, default: default.filesystem),
              size:        convert_size(logical_volume_json, default: default.size),
              name:        logical_volume_json[:name],
              stripes:     logical_volume_json[:stripes],
              stripe_size: convert_stripe_size,
              pool:        logical_volume_json[:pool],
              used_pool:   logical_volume_json[:usedPool]
            }
          end

          # @return [Y2Storage::DiskSize, nil]
          def convert_stripe_size
            value = logical_volume_json[:stripeSize]
            return unless value

            Y2Storage::DiskSize.new(value)
          end
        end
      end
    end
  end
end
