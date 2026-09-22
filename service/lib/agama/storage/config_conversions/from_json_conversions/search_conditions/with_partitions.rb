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

require "agama/storage/config_conversions/from_json_conversions/search_conditions/" \
        "partitions_condition"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        module SearchConditions
          # Mixin for converters supporting the partitions condition.
          #
          # Only for converters of a search of partitionable devices.
          module WithPartitions
          private

            # @see Base#convert_leaf
            def convert_leaf(json)
              return partitions_converter.convert(json[:partitions]) if json.key?(:partitions)

              super
            end

            # @return [PartitionsCondition]
            def partitions_converter
              @partitions_converter ||= PartitionsCondition.new
            end
          end
        end
      end
    end
  end
end
