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
require "agama/storage/config_solvers/search_matchers/volume_group"
require "y2storage"

describe Agama::Storage::ConfigSolvers::SearchMatchers::VolumeGroup do
  include Agama::RSpec::StorageHelpers
  include Agama::RSpec::SearchMatcherHelpers

  subject { described_class.new }

  before do
    mock_storage(devicegraph: "several_vgs.yaml")
  end

  let(:devicegraph) { Y2Storage::StorageManager.instance.probed }

  describe "#match?" do
    let(:device) { devicegraph.find_by_name("/dev/system") }
    let(:other_device) { devicegraph.find_by_name("/dev/data") }

    include_examples "a matcher supporting the name condition"
    include_examples "a matcher supporting the size condition"
    include_examples "a matcher supporting operators"
    include_examples "a matcher rejecting the filesystem condition"
    include_examples "a matcher rejecting the partitions condition"
    include_examples "a matcher rejecting the partition number condition"
    include_examples "a matcher rejecting the partition id condition"
    include_examples "a matcher rejecting the driver condition"
    include_examples "a matcher rejecting the boss condition"
  end
end
