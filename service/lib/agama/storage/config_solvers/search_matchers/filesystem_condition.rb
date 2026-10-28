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
require "agama/storage/configs/search_conditions"

module Agama
  module Storage
    module ConfigSolvers
      module SearchMatchers
        # Evaluator of a filesystem condition (that is, a leaf of the condition tree of a device).
        #
        # There is no search of filesystems, so this class is the only user of the filesystem
        # conditions (type and label). Note the conditions nested into a filesystem condition are
        # matched against the filesystem of the device, and not against the device itself.
        class FilesystemCondition < Base
          # Whether the filesystem of the given device matches the condition.
          #
          # The nested conditions (object form) imply "formatted", so an unformatted device never
          # matches, no matter what the nested conditions are.
          #
          # @param node [Configs::SearchConditions::Filesystem]
          # @param device [Y2Storage::BlkDevice]
          #
          # @return [Boolean]
          def match?(node, device)
            filesystem = device.filesystem
            return match_presence?(node.presence, filesystem) unless node.condition
            return false unless filesystem

            # The subject of the nested conditions is the filesystem.
            super(node.condition, filesystem)
          end

        private

          # Whether the device matches the given filesystem presence.
          #
          # @param presence [:any, :none, nil] :any for formatted, :none for unformatted and nil
          #   for matching any device.
          # @param filesystem [Y2Storage::Filesystems::Base, nil]
          #
          # @return [Boolean]
          def match_presence?(presence, filesystem)
            case presence
            when :any
              !filesystem.nil?
            when :none
              filesystem.nil?
            else
              true
            end
          end

          # @see Base#match_leaf?
          #
          # @param node [Configs::SearchConditions::*]
          # @param filesystem [Y2Storage::Filesystems::Base]
          def match_leaf?(node, filesystem)
            case node
            when Configs::SearchConditions::FilesystemType
              match_type?(node, filesystem)
            when Configs::SearchConditions::FilesystemLabel
              match_label?(node, filesystem)
            else
              super
            end
          end

          # Whether the type of the given filesystem matches the condition node.
          #
          # @param node [Configs::SearchConditions::FilesystemType]
          # @param filesystem [Y2Storage::Filesystems::Base]
          #
          # @return [Boolean]
          def match_type?(node, filesystem)
            return true unless node.fs_type

            filesystem.type == node.fs_type
          end

          # Whether the label of the given filesystem matches the condition node.
          #
          # @param node [Configs::SearchConditions::FilesystemLabel]
          # @param filesystem [Y2Storage::Filesystems::Base]
          #
          # @return [Boolean]
          def match_label?(node, filesystem)
            return true unless node.label

            filesystem.label == node.label
          end
        end
      end
    end
  end
end
