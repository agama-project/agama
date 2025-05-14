# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
require "agama/storage/configs/search_conditions/size"
require "y2storage/disk_size"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        module SearchConditions
          # Size condition conversion from JSON according to schema.
          class Size < Base
          private

            # @see Base
            # @return [Configs::SearchConditions::Size]
            def default_config
              Configs::SearchConditions::Size.new
            end

            alias_method :size_json, :config_json

            # @see Base#conversions
            # @return [Hash]
            def conversions
              {
                value:    convert_value,
                operator: convert_operator
              }
            end

            # @return [Y2Storage::DiskSize]
            def convert_value
              value = size_json.is_a?(Hash) ? size_json.values.first : size_json

              Y2Storage::DiskSize.new(value)
            end

            # @return [Symbol, nil]
            def convert_operator
              return unless size_json.is_a?(Hash)

              size_json.keys.first.to_sym
            end
          end
        end
      end
    end
  end
end
