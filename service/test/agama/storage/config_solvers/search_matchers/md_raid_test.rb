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

require_relative "../../storage_helpers"
require_relative "examples"
require "agama/storage/config_solvers/search_matchers/md_raid"
require "y2storage"

describe Agama::Storage::ConfigSolvers::SearchMatchers::MdRaid do
  include Agama::RSpec::StorageHelpers
  include Agama::RSpec::SearchMatcherHelpers

  subject { described_class.new }

  before do
    mock_storage(devicegraph: "md_raids_formatted.yaml")
  end

  let(:devicegraph) { Y2Storage::StorageManager.instance.probed }

  describe "#match?" do
    # Partitioned and unformatted.
    let(:device) { devicegraph.find_by_name("/dev/md0") }
    # Unpartitioned and formatted (ext4).
    let(:other_device) { devicegraph.find_by_name("/dev/md1") }
    # Formatted (xfs with label).
    let(:formatted_device) { devicegraph.find_by_name("/dev/md2") }
    let(:unformatted_device) { device }
    let(:filesystem_type) { "xfs" }
    let(:other_filesystem_type) { "ext4" }
    let(:partitioned_device) { device }
    let(:unpartitioned_device) { other_device }
    let(:partition_number) { 1 }
    let(:missing_partition_number) { 9 }

    include_examples "a matcher supporting the name condition"
    include_examples "a matcher supporting the size condition"
    include_examples "a matcher supporting the filesystem condition"
    include_examples "a matcher supporting the partitions condition"
    include_examples "a matcher supporting operators"
    include_examples "a matcher rejecting the partition number condition"
    include_examples "a matcher rejecting the partition id condition"
    include_examples "a matcher rejecting the driver condition"
    include_examples "a matcher rejecting the transport condition"
  end
end
