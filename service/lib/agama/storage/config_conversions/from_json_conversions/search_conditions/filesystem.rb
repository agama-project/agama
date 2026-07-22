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

require "agama/storage/config_conversions/from_json_conversions/base"
require "agama/storage/configs/search_conditions"
require "y2storage/filesystems/type"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        module SearchConditions
          # Filesystem condition conversion from JSON according to schema.
          class Filesystem < Base
          private

            # @see Base
            # @return [Configs::SearchConditions::Filesystem]
            def default_config
              Configs::SearchConditions::Filesystem.new
            end

            alias_method :filesystem_json, :config_json

            # @see Base#conversions
            # @return [Hash]
            def conversions
              {
                presence:  convert_presence,
                condition: convert_condition
              }
            end

            # @return [Symbol, nil] :any or :none for the presence shortcut, nil otherwise.
            def convert_presence
              return unless filesystem_json.is_a?(String)

              filesystem_json.to_sym
            end

            # Recursively converts a filesystem condition JSON into a condition config.
            #
            # @param json [Hash, nil] defaults to the top-level condition object.
            # @return [Configs::SearchConditions::FilesystemType,
            #   Configs::SearchConditions::FilesystemLabel, Configs::SearchConditions::And,
            #   Configs::SearchConditions::Or, Configs::SearchConditions::Not, nil]
            def convert_condition(json = filesystem_json)
              return if json.is_a?(String) || json.nil?

              _key, builder = condition_builders.find { |k, _| json.key?(k) }
              builder&.call(json)
            end

            # Builders for each type of filesystem condition, indexed by its JSON key.
            #
            # @return [Hash{Symbol => Proc}]
            def condition_builders
              {
                type:  ->(j) { type_condition(j[:type]) },
                label: ->(j) { Configs::SearchConditions::FilesystemLabel.new(j[:label]) },
                and:   ->(j) { Configs::SearchConditions::And.new(convert_conditions(j[:and])) },
                or:    ->(j) { Configs::SearchConditions::Or.new(convert_conditions(j[:or])) },
                not:   ->(j) { Configs::SearchConditions::Not.new(convert_condition(j[:not])) }
              }
            end

            # Converts a collection of filesystem condition JSONs into condition configs.
            #
            # @param json [Array<Hash>]
            # @return [Array]
            def convert_conditions(json)
              json.map { |c| convert_condition(c) }
            end

            # @param value [String]
            # @return [Configs::SearchConditions::FilesystemType]
            def type_condition(value)
              fs_type = Y2Storage::Filesystems::Type.find(value.to_sym)
              Configs::SearchConditions::FilesystemType.new(fs_type)
            end
          end
        end
      end
    end
  end
end
