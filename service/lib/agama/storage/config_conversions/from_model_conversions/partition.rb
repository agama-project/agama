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
require "agama/storage/config_conversions/from_model_conversions/with_search"
require "agama/storage/config_conversions/from_model_conversions/with_size"
require "agama/storage/configs/partition"
require "y2storage/partition_id"

module Agama
  module Storage
    module ConfigConversions
      module FromModelConversions
        # Partition conversion from model according to the JSON schema.
        class Partition < Base
        private

          include WithSearch
          include WithFilesystem
          include WithSize

          # @see Base
          # @return [Configs::Partition]
          def default_config
            Configs::Partition.new
          end

          alias_method :partition_model, :model_json

          # @see Base#conversions
          # @return [Hash]
          def conversions
            {
              search:           convert_search,
              alias:            partition_model[:alias],
              filesystem:       convert_filesystem,
              size:             convert_size,
              id:               convert_id,
              delete:           convert_delete,
              delete_if_needed: convert_delete_if_needed
            }
          end

          # @return [Y2Storage::PartitionId, nil]
          def convert_id
            value = partition_model[:id]
            return unless value

            Y2Storage::PartitionId.find(value)
          end

          # TODO: do not delete if the partition is used by other device (VG, RAID, etc).
          # @return [Boolean]
          def convert_delete
            # Do not mark to delete if the partition is used.
            return false if partition_model[:mountPath]

            partition_model[:delete]
          end

          # TODO: do not delete if the partition is used by other device (VG, RAID, etc).
          # @return [Boolean]
          def convert_delete_if_needed
            # Do not mark to delete if the partition is used.
            return false if partition_model[:mountPath]

            partition_model[:deleteIfNeeded]
          end
        end
      end
    end
  end
end
