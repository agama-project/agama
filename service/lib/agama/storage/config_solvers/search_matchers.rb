# frozen_string_literal: true

# Copyright (c) [2025-2026] SUSE LLC
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

require "agama/storage/configs/search_conditions"

module Agama
  module Storage
    module ConfigSolvers
      # Matchers for searching devices.
      module SearchMatchers
        # Whether the given device matches the search condition of the config.
        #
        # @param config [#search]
        # @param device [Y2Storage::Device]
        #
        # @return [Boolean]
        def match_condition?(config, device)
          condition = config.search&.condition
          return true unless condition

          match_node?(condition, device)
        end

      private

        # Recursively evaluates a condition node against a device.
        #
        # @param node [Configs::SearchConditions::*]
        # @param device [Y2Storage::Device]
        #
        # @return [Boolean]
        def match_node?(node, device)
          case node
          when Configs::SearchConditions::And
            node.conditions.all? { |c| match_node?(c, device) }
          when Configs::SearchConditions::Or
            node.conditions.any? { |c| match_node?(c, device) }
          when Configs::SearchConditions::Not
            !match_node?(node.condition, device)
          else
            match_leaf?(node, device)
          end
        end

        # Evaluates a leaf condition node against a device.
        #
        # @param node [Configs::SearchConditions::*]
        # @param device [Y2Storage::Device]
        #
        # @return [Boolean]
        def match_leaf?(node, device)
          case node
          when Configs::SearchConditions::Name
            match_name?(node, device)
          when Configs::SearchConditions::Size
            match_size?(node, device)
          when Configs::SearchConditions::PartitionNumber
            match_partition_number?(node, device)
          else
            match_filesystem_leaf?(node, device)
          end
        end

        # Evaluates a filesystem leaf condition node against a device.
        #
        # @param node [Configs::SearchConditions::*]
        # @param device [Y2Storage::Device]
        #
        # @return [Boolean]
        def match_filesystem_leaf?(node, device)
          case node
          when Configs::SearchConditions::Filesystem
            match_filesystem?(node, device)
          when Configs::SearchConditions::FilesystemType
            match_filesystem_type?(node, device)
          when Configs::SearchConditions::FilesystemLabel
            match_filesystem_label?(node, device)
          else
            false
          end
        end

        # Whether the name of the given device matches the condition node.
        #
        # @param node [Configs::SearchConditions::Name]
        # @param device [Y2Storage::Device]
        #
        # @return [Boolean]
        def match_name?(node, device)
          return true unless node.name

          found_device = device.devicegraph.find_by_any_name(node.name)
          found_device&.sid == device.sid
        end

        # Whether the size of the given device matches the condition node.
        #
        # @param node [Configs::SearchConditions::Size]
        # @param device [Y2Storage::Device]
        #
        # @return [Boolean]
        def match_size?(node, device)
          return true unless node.value

          case node.operator
          when :equal
            device.size == node.value
          when :greater
            device.size > node.value
          when :less
            device.size < node.value
          else
            false
          end
        end

        # Whether the number of the given partition matches the condition node.
        #
        # @param node [Configs::SearchConditions::PartitionNumber]
        # @param device [Y2Storage::Device]
        #
        # @return [Boolean]
        def match_partition_number?(node, device)
          return false unless device.is?(:partition)

          device.number == node.number
        end

        # Whether the filesystem of the given device matches the condition node.
        #
        # The object (condition) form implies "formatted", so it requires a filesystem
        # before evaluating the nested condition. The presence shortcut checks whether the
        # device is formatted (:any) or unformatted (:none).
        #
        # @param node [Configs::SearchConditions::Filesystem]
        # @param device [Y2Storage::Device]
        #
        # @return [Boolean]
        def match_filesystem?(node, device)
          filesystem = device_filesystem(device)
          return !filesystem.nil? && match_node?(node.condition, device) if node.condition

          case node.presence
          when :any
            !filesystem.nil?
          when :none
            filesystem.nil?
          else
            true
          end
        end

        # Whether the filesystem type of the given device matches the condition node.
        #
        # @param node [Configs::SearchConditions::FilesystemType]
        # @param device [Y2Storage::Device]
        #
        # @return [Boolean]
        def match_filesystem_type?(node, device)
          return true unless node.fs_type

          filesystem = device_filesystem(device)
          return false unless filesystem

          filesystem.type == node.fs_type
        end

        # Whether the filesystem label of the given device matches the condition node.
        #
        # @param node [Configs::SearchConditions::FilesystemLabel]
        # @param device [Y2Storage::Device]
        #
        # @return [Boolean]
        def match_filesystem_label?(node, device)
          return true unless node.label

          filesystem = device_filesystem(device)
          return false unless filesystem

          filesystem.label == node.label
        end

        # Filesystem of the given device, if any.
        #
        # @param device [Y2Storage::Device]
        # @return [Y2Storage::Filesystems::Base, nil]
        def device_filesystem(device)
          return unless device.respond_to?(:filesystem)

          device.filesystem
        end
      end
    end
  end
end
