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
require "agama/storage/config_solvers/search_matchers/partitions_condition"
require "y2storage"

describe Agama::Storage::ConfigSolvers::SearchMatchers::PartitionsCondition do
  include Agama::RSpec::StorageHelpers
  include Agama::RSpec::SearchMatcherHelpers

  subject { described_class.new }

  before do
    mock_storage(devicegraph: "disks.yaml")
  end

  let(:devicegraph) { Y2Storage::StorageManager.instance.probed }

  describe "#match?" do
    let(:partitioned_device) { devicegraph.find_by_name("/dev/vda") }
    let(:unpartitioned_device) { devicegraph.find_by_name("/dev/vdb") }
    let(:partition_number) { 2 }
    let(:missing_partition_number) { 9 }

    include_examples "a matcher supporting the partitions condition"

    # The conditions nested into a quantifier are matched against each partition, so all the
    # conditions supported by a partition search are expected to work here too.
    describe "with conditions nested into a quantifier" do
      it "supports the name condition" do
        json = { partitions: { any: { name: "/dev/vda2" } } }
        expect(subject.match?(condition(json), partitioned_device)).to eq(true)

        json = { partitions: { any: { name: "/dev/vdb" } } }
        expect(subject.match?(condition(json), partitioned_device)).to eq(false)
      end

      it "supports the size condition" do
        json = { partitions: { any: { size: { greater: "15 GiB" } } } }
        expect(subject.match?(condition(json), partitioned_device)).to eq(true)

        json = { partitions: { all: { size: { greater: "15 GiB" } } } }
        expect(subject.match?(condition(json), partitioned_device)).to eq(false)
      end

      it "supports the filesystem condition" do
        json = { partitions: { any: { filesystem: { type: "btrfs" } } } }
        expect(subject.match?(condition(json), partitioned_device)).to eq(true)

        # /dev/vda1 is not formatted.
        json = { partitions: { all: { filesystem: "any" } } }
        expect(subject.match?(condition(json), partitioned_device)).to eq(false)
      end

      it "supports the partition number condition" do
        json = { partitions: { any: { number: 3 } } }
        expect(subject.match?(condition(json), partitioned_device)).to eq(true)

        json = { partitions: { any: { number: 9 } } }
        expect(subject.match?(condition(json), partitioned_device)).to eq(false)
      end

      it "supports operators" do
        json = {
          partitions: {
            any: { and: [{ number: 2 }, { filesystem: { type: "btrfs" } }] }
          }
        }
        expect(subject.match?(condition(json), partitioned_device)).to eq(true)

        json = {
          partitions: {
            any: { and: [{ number: 2 }, { filesystem: { type: "xfs" } }] }
          }
        }
        expect(subject.match?(condition(json), partitioned_device)).to eq(false)
      end

      it "does not support the partitions condition" do
        # A partitions condition nested into a quantifier cannot be expressed with JSON (the
        # conversion simply ignores it), so the condition is directly built here.
        conditions_module = Agama::Storage::Configs::SearchConditions
        nested = conditions_module::Partitions.new(presence: :none)
        quantifier = conditions_module::PartitionsAny.new(nested)
        node = conditions_module::Partitions.new(condition: quantifier)

        expect(subject.match?(node, partitioned_device)).to eq(false)
      end
    end
  end
end
