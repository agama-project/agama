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
require "agama/storage/configs/search_conditions"
require "y2storage/filesystems/type"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        module SearchConditions
          # Converter of a filesystem condition (that is, a leaf of the condition tree of a
          # device), see {WithFilesystem}.
          #
          # There is no search of filesystems, so this class is the only user of the filesystem
          # conditions (type and label). The operators of the nested condition are converted by
          # the inherited methods.
          class FilesystemCondition < Base
            # Converts the value of a filesystem leaf into a condition config.
            #
            # @param json [String, Hash] Either a presence shortcut ("any" or "none") or a nested
            #   condition over the filesystem properties.
            #
            # @return [Configs::SearchConditions::Filesystem]
            def convert(json)
              return presence_condition(json) if json.is_a?(String)

              Configs::SearchConditions::Filesystem.new(condition: convert_node(json))
            end

          private

            # @param value [String] "any" or "none".
            # @return [Configs::SearchConditions::Filesystem]
            def presence_condition(value)
              Configs::SearchConditions::Filesystem.new(presence: value.to_sym)
            end

            # @see Base#convert_leaf
            def convert_leaf(json)
              return type_condition(json[:type]) if json.key?(:type)
              return label_condition(json[:label]) if json.key?(:label)

              super
            end

            # @param value [String]
            # @return [Configs::SearchConditions::FilesystemType]
            def type_condition(value)
              fs_type = Y2Storage::Filesystems::Type.find(value.to_sym)
              Configs::SearchConditions::FilesystemType.new(fs_type)
            end

            # @param value [String]
            # @return [Configs::SearchConditions::FilesystemLabel]
            def label_condition(value)
              Configs::SearchConditions::FilesystemLabel.new(value)
            end
          end
        end
      end
    end
  end
end
