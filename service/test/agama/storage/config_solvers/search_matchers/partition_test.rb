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
require "agama/storage/config_solvers/search_matchers/partition"
require "y2storage"

describe Agama::Storage::ConfigSolvers::SearchMatchers::Partition do
  include Agama::RSpec::StorageHelpers
  include Agama::RSpec::SearchMatcherHelpers

  subject { described_class.new }

  before do
    mock_storage(devicegraph: "disks.yaml")
  end

  let(:devicegraph) { Y2Storage::StorageManager.instance.probed }

  describe "#match?" do
    # Formatted (btrfs with label).
    let(:device) { devicegraph.find_by_name("/dev/vda2") }
    # Formatted (xfs with label).
    let(:other_device) { devicegraph.find_by_name("/dev/vda3") }
    let(:formatted_device) { device }
    # Unformatted.
    let(:unformatted_device) { devicegraph.find_by_name("/dev/vda1") }
    let(:filesystem_type) { "btrfs" }
    let(:other_filesystem_type) { "xfs" }

    include_examples "a matcher supporting the name condition"
    include_examples "a matcher supporting the size condition"
    include_examples "a matcher supporting the filesystem condition"
    include_examples "a matcher supporting operators"
    include_examples "a matcher rejecting the partitions condition"
    include_examples "a matcher rejecting the driver condition"

    describe "with a partition number condition" do
      it "matches if the partition has the given number" do
        expect(subject.match?(condition(number: 2), device)).to eq(true)
      end

      it "does not match if the partition has another number" do
        expect(subject.match?(condition(number: 3), device)).to eq(false)
      end
    end

    describe "with a partition id condition" do
      it "matches if the partition has the given id" do
        expect(subject.match?(condition(id: "linux"), device)).to eq(true)
      end

      it "does not match if the partition has another id" do
        expect(subject.match?(condition(id: "esp"), device)).to eq(false)
      end
    end
  end
end
