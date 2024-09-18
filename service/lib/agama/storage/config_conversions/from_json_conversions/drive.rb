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
require "agama/storage/config_conversions/from_json_conversions/with_partitions"
require "agama/storage/config_conversions/from_json_conversions/with_ptable_type"
require "agama/storage/config_conversions/from_json_conversions/with_search"
require "agama/storage/configs/drive"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Drive conversion from JSON hash according to schema.
        class Drive < Base
          include WithSearch
          include WithEncryption
          include WithFilesystem
          include WithPtableType
          include WithPartitions

          # @param drive_json [Hash]
          # @param config_builder [ConfigBuilder, nil]
          def initialize(drive_json, config_builder: nil)
            super(config_builder)
            @drive_json = drive_json
          end

          # @see Base#convert
          #
          # @param default [Configs::Drive, nil]
          # @return [Configs::Drive]
          def convert(default = nil)
            super(default || Configs::Drive.new)
          end

        private

          # @return [Hash]
          attr_reader :drive_json

          # @see Base#conversions
          #
          # @param default [Configs::Drive]
          # @return [Hash]
          def conversions(default)
            {
              search:      convert_search(drive_json, default: default.search),
              alias:       drive_json[:alias],
              encryption:  convert_encryption(drive_json, default: default.encryption),
              filesystem:  convert_filesystem(drive_json, default: default.filesystem),
              ptable_type: convert_ptable_type(drive_json),
              partitions:  convert_partitions(drive_json)
            }
          end
        end
      end
    end
  end
end
