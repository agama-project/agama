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

require "agama/storage/config_conversions/from_model_conversions/partition"
require "agama/storage/configs/partition"

module Agama
  module Storage
    module ConfigConversions
      module FromModelConversions
        # Mixin for partitions conversion.
        module WithPartitions
          # @return [Array<Configs::Partition>]
          def convert_partitions
            space_policy = model_json[:spacePolicy]

            case space_policy
            when "keep"
              used_partition_configs
            when "delete"
              [used_partition_configs, delete_all_partition_config].flatten
            when "resize"
              [used_partition_configs, resize_all_partition_config].flatten
            else
              partition_configs
            end
          end

          # @param partition_model [Hash]
          # @return [Configs::Partition]
          def convert_partition(partition_model)
            FromModelConversions::Partition.new(partition_model).convert
          end

          # @return [Array<Configs::Partition>]
          def partition_configs
            partitions.map { |p| convert_partition(p) }
          end

          # @return [Array<Configs::Partition>]
          def used_partition_configs
            used_partitions.map { |p| convert_partition(p) }
          end

          # @return [Array<Hash>]
          def partitions
            model_json[:partitions] || []
          end

          # @return [Array<Hash>]
          def used_partitions
            partitions.select { |p| used_partition?(p) }
          end

          # @param partition_model [Hash]
          # @return [Boolean]
          def used_partition?(partition_model)
            new_partition?(partition_model) || reused_partition?(partition_model)
          end

          # @param partition_model [Hash]
          # @return [Boolean]
          def new_partition?(partition_model)
            partition_model[:name].nil? &&
              !partition_model[:delete] &&
              !partition_model[:deleteIfNeeded]
          end

          # @param partition_model [Hash]
          # @return [Boolean]
          def reused_partition?(partition_model)
            # TODO: improve check by ensuring the alias is referenced by other device.
            any_usage = partition_model[:mountPath] ||
              partition_model[:filesystem] ||
              partition_model[:alias]

            any_usage &&
              partition_model[:name] &&
              !partition_model[:delete] &&
              !partition_model[:deleteIfNeeded]
          end

          # @return [Configs::Partition]
          def delete_all_partition_config
            Configs::Partition.new_for_delete_all
          end

          # @return [Configs::Partition]
          def resize_all_partition_config
            Configs::Partition.new_for_shrink_any_if_needed
          end
        end
      end
    end
  end
end
