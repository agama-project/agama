# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require "agama/storage/config_conversions/from_json_conversions/search_conditions/base"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/with_filesystem"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/with_name"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/" \
        "with_partition_id"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/" \
        "with_partition_number"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/with_size"
require "agama/storage/configs/search_conditions"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        module SearchConditions
          # Converter of a partitions condition (that is, a leaf of the condition tree of a
          # device), see {WithPartitions}.
          #
          # Note this class plays two roles: it converts the partitions leaf of a device (see
          # {#convert}) and it also converts the conditions nested into the quantifiers, whose
          # subject is a partition and not the device itself (see {Base#convert_node}). The leaf
          # mixins are the ones a partition supports.
          #
          # Those mixins are the very same ones included by {SearchConditions::Partition}, but both
          # lists are deliberately independent: the conditions of a partitions quantifier and the
          # conditions of a search of partitions could diverge in the future.
          class PartitionsCondition < Base
            include WithName
            include WithSize
            include WithPartitionNumber
            include WithPartitionId
            include WithFilesystem

            # Converts the value of a partitions leaf into a condition config.
            #
            # @param json [String, Hash] Either a presence shortcut ("any" or "none") or a
            #   quantifier over the partitions.
            #
            # @return [Configs::SearchConditions::Partitions]
            def convert(json)
              return presence_condition(json) if json.is_a?(String)

              Configs::SearchConditions::Partitions.new(condition: convert_quantifier(json))
            end

          private

            # @param value [String] "any" or "none".
            # @return [Configs::SearchConditions::Partitions]
            def presence_condition(value)
              Configs::SearchConditions::Partitions.new(presence: value.to_sym)
            end

            # Converts a partitions quantifier JSON into a quantifier config.
            #
            # @param json [Hash]
            # @return [Configs::SearchConditions::PartitionsAny,
            #   Configs::SearchConditions::PartitionsNone,
            #   Configs::SearchConditions::PartitionsAll,
            #   Configs::SearchConditions::PartitionsCount]
            def convert_quantifier(json)
              unsupported_condition(json) unless json.is_a?(Hash)

              return partitions_any(json[:any]) if json.key?(:any)
              return partitions_none(json[:none]) if json.key?(:none)
              return partitions_all(json[:all]) if json.key?(:all)
              return partitions_count(json[:count]) if json.key?(:count)

              unsupported_condition(json)
            end

            # @param json [Hash]
            # @return [Configs::SearchConditions::PartitionsAny]
            def partitions_any(json)
              Configs::SearchConditions::PartitionsAny.new(convert_partition_condition(json))
            end

            # @param json [Hash]
            # @return [Configs::SearchConditions::PartitionsNone]
            def partitions_none(json)
              Configs::SearchConditions::PartitionsNone.new(convert_partition_condition(json))
            end

            # @param json [Hash]
            # @return [Configs::SearchConditions::PartitionsAll]
            def partitions_all(json)
              Configs::SearchConditions::PartitionsAll.new(convert_partition_condition(json))
            end

            # @param json [Hash]
            # @return [Configs::SearchConditions::PartitionsCount]
            def partitions_count(json)
              Configs::SearchConditions::PartitionsCount.new(
                condition: convert_partition_condition(json[:condition]),
                min:       json[:min],
                max:       json[:max]
              )
            end

            # Converts a condition nested into a quantifier.
            #
            # Note the nil check is not performed by {Base#convert}, which is overridden by this
            # class with a different meaning. The condition of a count quantifier is optional.
            #
            # @param json [Hash, nil] nil means "no condition".
            # @return [Configs::SearchConditions::*, nil]
            def convert_partition_condition(json)
              return unless json

              convert_node(json)
            end
          end
        end
      end
    end
  end
end
