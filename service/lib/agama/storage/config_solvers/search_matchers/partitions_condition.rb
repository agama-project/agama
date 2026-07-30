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

require "agama/storage/config_solvers/search_matchers/base"
require "agama/storage/config_solvers/search_matchers/with_filesystem"
require "agama/storage/config_solvers/search_matchers/with_name"
require "agama/storage/config_solvers/search_matchers/with_partition_number"
require "agama/storage/config_solvers/search_matchers/with_size"
require "agama/storage/configs/search_conditions"

module Agama
  module Storage
    module ConfigSolvers
      module SearchMatchers
        # Evaluator of a partitions condition (that is, a leaf of the condition tree of a device).
        #
        # Note the conditions nested into the quantifiers are matched against each partition of
        # the device, and not against the device itself. Those conditions are the same ones
        # supported by {SearchMatchers::Partition}, so both classes must include the same leaf
        # mixins.
        class PartitionsCondition < Base
          include WithName
          include WithSize
          include WithFilesystem
          include WithPartitionNumber

          # Whether the partitions of the given device match the condition.
          #
          # Note the subject of this method is the device, in contrast to the inherited matching
          # methods, whose subject is a single partition.
          #
          # @param node [Configs::SearchConditions::Partitions]
          # @param device [Y2Storage::Partitionable]
          #
          # @return [Boolean]
          def match?(node, device)
            partitions = device.partitions
            return match_quantifier?(node.condition, partitions) if node.condition

            match_presence?(node.presence, partitions)
          end

        private

          # Whether the device matches the given partitions presence.
          #
          # @param presence [:any, :none, nil] :any for devices with partitions, :none for devices
          #   without partitions and nil for matching any device.
          # @param partitions [Array<Y2Storage::Partition>]
          #
          # @return [Boolean]
          def match_presence?(presence, partitions)
            case presence
            when :any
              partitions.any?
            when :none
              partitions.empty?
            else
              true
            end
          end

          # @param quantifier [PartitionsAny, PartitionsNone, PartitionsAll, PartitionsCount]
          # @param partitions [Array<Y2Storage::Partition>]
          #
          # @return [Boolean]
          def match_quantifier?(quantifier, partitions)
            case quantifier
            when Configs::SearchConditions::PartitionsAny
              match_any?(quantifier, partitions)
            when Configs::SearchConditions::PartitionsNone
              match_none?(quantifier, partitions)
            when Configs::SearchConditions::PartitionsAll
              match_all?(quantifier, partitions)
            when Configs::SearchConditions::PartitionsCount
              match_count?(quantifier, partitions)
            end
          end

          # @param quantifier [Configs::SearchConditions::PartitionsAny]
          # @param partitions [Array<Y2Storage::Partition>]
          #
          # @return [Boolean]
          def match_any?(quantifier, partitions)
            condition = quantifier.condition
            return partitions.any? unless condition

            partitions.any? { |p| match_partition?(condition, p) }
          end

          # @param quantifier [Configs::SearchConditions::PartitionsNone]
          # @param partitions [Array<Y2Storage::Partition>]
          #
          # @return [Boolean]
          def match_none?(quantifier, partitions)
            condition = quantifier.condition
            return partitions.empty? unless condition

            partitions.none? { |p| match_partition?(condition, p) }
          end

          # Requires at least one partition; all partitions must satisfy the condition.
          #
          # @param quantifier [Configs::SearchConditions::PartitionsAll]
          # @param partitions [Array<Y2Storage::Partition>]
          #
          # @return [Boolean]
          def match_all?(quantifier, partitions)
            return false if partitions.empty?

            condition = quantifier.condition
            return true unless condition

            partitions.all? { |p| match_partition?(condition, p) }
          end

          # @param quantifier [Configs::SearchConditions::PartitionsCount]
          # @param partitions [Array<Y2Storage::Partition>]
          #
          # @return [Boolean]
          def match_count?(quantifier, partitions)
            count = partitions_count(quantifier.condition, partitions)

            (quantifier.min.nil? || count >= quantifier.min) &&
              (quantifier.max.nil? || count <= quantifier.max)
          end

          # Number of partitions matching the given condition.
          #
          # @param condition [Configs::SearchConditions::*, nil] nil counts all the partitions.
          # @param partitions [Array<Y2Storage::Partition>]
          #
          # @return [Integer]
          def partitions_count(condition, partitions)
            return partitions.count unless condition

            partitions.count { |p| match_partition?(condition, p) }
          end

          # Whether the given partition matches the condition.
          #
          # @param condition [Configs::SearchConditions::*]
          # @param partition [Y2Storage::Partition]
          #
          # @return [Boolean]
          def match_partition?(condition, partition)
            # The subject of the nested conditions is a partition.
            match_node?(condition, partition)
          end
        end
      end
    end
  end
end
