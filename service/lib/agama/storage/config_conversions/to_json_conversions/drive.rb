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

require "agama/storage/config_conversions/to_json_conversions/base"
require "agama/storage/config_conversions/to_json_conversions/with_encryption"
require "agama/storage/config_conversions/to_json_conversions/with_filesystem"
require "agama/storage/config_conversions/to_json_conversions/with_partitions"
require "agama/storage/config_conversions/to_json_conversions/with_ptable_type"
require "agama/storage/config_conversions/to_json_conversions/with_search"
require "agama/storage/configs/drive"

module Agama
  module Storage
    module ConfigConversions
      module ToJSONConversions
        # Drive conversion to JSON hash according to schema.
        class Drive < Base
          include WithSearch
          include WithEncryption
          include WithFilesystem
          include WithPtableType
          include WithPartitions

          # @see Base
          def self.config_type
            Configs::Drive
          end

        private

          # @see Base#conversions
          def conversions
            {
              index:      config.index,
              search:     convert_search,
              alias:      config.alias,
              encryption: convert_encryption,
              filesystem: convert_filesystem,
              ptableType: convert_ptable_type,
              partitions: convert_partitions
            }
          end
        end
      end
    end
  end
end
