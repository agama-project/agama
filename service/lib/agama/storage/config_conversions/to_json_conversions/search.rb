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

require "agama/storage/config_conversions/to_json_conversions/base"
require "agama/storage/configs/search"

module Agama
  module Storage
    module ConfigConversions
      module ToJSONConversions
        # Search conversion to JSON hash according to schema.
        class Search < Base
          # @see Base
          def self.config_type
            Configs::Search
          end

          # @see Base#convert
          def convert
            return SEARCH_ANYTHING_STRING if config.all_if_any?

            super
          end

        private

          # @see Base#conversions
          def conversions
            {
              condition:  convert_condition,
              ifNotFound: config.if_not_found.to_s,
              max:        config.max
            }
          end

          # @return [Hash, nil]
          def convert_condition
            name = config.name || config.device&.name
            return unless name

            { name: name }
          end
        end
      end
    end
  end
end
