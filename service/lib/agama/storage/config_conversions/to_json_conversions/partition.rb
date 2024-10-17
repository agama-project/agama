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
require "agama/storage/config_conversions/to_json_conversions/with_search"
require "agama/storage/config_conversions/to_json_conversions/with_size"
require "agama/storage/configs/partition"

module Agama
  module Storage
    module ConfigConversions
      module ToJSONConversions
        # Partition conversion to JSON hash according to schema.
        class Partition < Base
          include WithSearch
          include WithEncryption
          include WithFilesystem
          include WithSize

          # @see Base
          def self.config_type
            Configs::Partition
          end

        private

          # @see Base#conversions
          def conversions
            return convert_delete if config.delete?

            return convert_delete_if_needed if config.delete_if_needed?

            {
              search:     convert_search,
              alias:      config.alias,
              encryption: convert_encryption,
              filesystem: convert_filesystem,
              size:       convert_size,
              id:         config.id&.to_s
            }
          end

          # @return [Hash]
          def convert_delete
            {
              search: convert_search,
              delete: true
            }
          end

          # @return [Hash]
          def convert_delete_if_needed
            {
              search:         convert_search,
              size:           convert_size,
              deleteIfNeeded: true
            }
          end
        end
      end
    end
  end
end
