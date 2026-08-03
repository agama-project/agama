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

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Namespace for conversions of search conditions from JSON.
        #
        # There is a converter for the conditions of each type of searchable device (e.g.,
        # {SearchConditions::Drive}), used by the corresponding search converter (e.g.,
        # {FromJSONConversions::DriveSearch}). Each converter supports the conditions that the
        # JSON schema allows for its device, see {SearchConditions::Base}. This mirrors the design
        # of the matchers used for solving a search, see {ConfigSolvers::SearchMatchers}.
        #
        # The composite conditions (size, filesystem and partitions) have their own converters:
        # {SearchConditions::SizeCondition}, {SearchConditions::FilesystemCondition} and
        # {SearchConditions::PartitionsCondition}. As their matcher counterparts,
        # {SearchConditions::FilesystemCondition} and {SearchConditions::PartitionsCondition}
        # convert their own nested conditions, so they include their own leaf mixins.
        module SearchConditions
        end
      end
    end
  end
end

require "agama/storage/config_conversions/from_json_conversions/search_conditions/base"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/with_name"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/with_size"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/with_driver"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/" \
        "with_partition_number"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/" \
        "with_partition_id"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/with_filesystem"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/with_partitions"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/size_condition"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/" \
        "filesystem_condition"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/" \
        "partitions_condition"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/drive"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/md_raid"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/volume_group"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/logical_volume"
require "agama/storage/config_conversions/from_json_conversions/search_conditions/partition"
