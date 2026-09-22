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

require "agama/storage/config_conversions/from_json_conversions/device_search"
require "agama/storage/config_conversions/from_json_conversions/search_conditions"
require "agama/storage/configs/sort_criteria"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # MD RAID search conversion from JSON hash according to schema.
        class MdRaidSearch < DeviceSearch
        private

          SORT_CRITERIA = {
            name: Configs::SortCriteria::Name,
            size: Configs::SortCriteria::Size
          }.freeze
          private_constant :SORT_CRITERIA

          # @see DeviceSearch
          # @return [SearchConditions::MdRaid]
          def condition_converter
            @condition_converter ||= SearchConditions::MdRaid.new
          end

          # @see DeviceSearch
          # @return [Hash{Symbol => Class}]
          def sort_criteria_classes
            SORT_CRITERIA
          end
        end
      end
    end
  end
end
