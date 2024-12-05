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

require "agama/storage/config_conversions/from_model_conversions/base"
require "agama/storage/config_conversions/from_model_conversions/with_filesystem"
require "agama/storage/config_conversions/from_model_conversions/with_partitions"
require "agama/storage/config_conversions/from_model_conversions/with_ptable_type"
require "agama/storage/config_conversions/from_model_conversions/with_search"
require "agama/storage/configs/drive"

module Agama
  module Storage
    module ConfigConversions
      module FromModelConversions
        # Drive conversion from model according to the JSON schema.
        class Drive < Base
        private

          include WithFilesystem
          include WithPtableType
          include WithPartitions
          include WithSearch

          alias_method :drive_model, :model_json

          # @see Base
          # @return [Configs::Drive]
          def default_config
            Configs::Drive.new
          end

          # @see Base#conversions
          # @return [Hash]
          def conversions
            {
              search:      convert_search,
              alias:       drive_model[:alias],
              filesystem:  convert_filesystem,
              ptable_type: convert_ptable_type,
              partitions:  convert_partitions
            }
          end
        end
      end
    end
  end
end
