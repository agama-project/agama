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
            # If the model does not indicate a space policy, then the space policy defined by the
            # product is applied.
            space_policy = model_json[:spacePolicy] || product_config.space_policy

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

          # Partitions with any usage (format, mount, etc).
          #
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
            partitions.reject { |p| space_policy_partition?(p) }
          end

          # Whether the partition only represents a space policy action.
          #
          # @param partition_model [Hash]
          # @return [Boolean]
          def space_policy_partition?(partition_model)
            partition_model[:delete] ||
              partition_model[:deleteIfNeeded] ||
              resize_action_partition?(partition_model)
          end

          # @param partition_model [Hash]
          # @return [Boolean]
          def resize_action_partition?(partition_model)
            return false if partition_model[:name].nil? || any_usage?(partition_model)

            return true if partition_model[:resizeIfNeeded]

            partition_model[:size] && !partition_model.dig(:size, :default)
          end

          # TODO: improve check by ensuring the alias is referenced by other device.
          #
          # @param partition_model [Hash]
          # @return [Boolean]
          def any_usage?(partition_model)
            partition_model[:mountPath] ||
              partition_model[:filesystem] ||
              partition_model[:alias]
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
