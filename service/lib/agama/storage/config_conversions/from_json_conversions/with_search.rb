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

require "agama/storage/config_conversions/from_json_conversions/search"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Mixin for search conversion.
        module WithSearch
          # @param json [Hash]
          # @param default [Configs::Search, nil]
          #
          # @return [Configs::Search, nil]
          def convert_search(json, default: nil)
            search_json = json[:search]
            return unless search_json

            converter = FromJSONConversions::Search.new(search_json)
            converter.convert(default)
          end
        end
      end
    end
  end
end
