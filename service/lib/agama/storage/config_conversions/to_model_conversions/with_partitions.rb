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

require "agama/storage/config_conversions/to_model_conversions/partition"

module Agama
  module Storage
    module ConfigConversions
      module ToModelConversions
        # Mixin for partitions conversion to model according to the JSON schema.
        module WithPartitions
          # @return [Array<Hash>]
          def convert_partitions
            valid_partitions
              .map { |p| ToModelConversions::Partition.new(p).convert }
              .compact
          end

          # @return [Array<Configs::Partition>]
          def valid_partitions
            config.partitions.select { |p| valid_partition?(p) }
          end

          # @param partition_config [Configs::Partition]
          # @return [Boolean]
          def valid_partition?(partition_config)
            valid_new_partition(partition_config) || valid_existing_partition(partition_config)
          end

          # @param partition_config [Configs::Partition]
          # @return [Boolean]
          def valid_new_partition(partition_config)
            delete = partition_config.delete? || partition_config.delete_if_needed?
            return false if delete

            partition_config.search.nil? || partition_config.search.create_device?
          end

          # @param partition_config [Configs::Partition]
          # @return [Boolean]
          def valid_existing_partition(partition_config)
            !partition_config.found_device.nil?
          end
        end
      end
    end
  end
end
