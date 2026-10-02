#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2018] SUSE LLC
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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"
require "y2storage"

describe Y2Storage::PartitionTables::ImplicitPt do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)
  end

  subject { device.partition_table }

  let(:device) { fake_devicegraph.find_by_name(device_name) }

  let(:scenario) { "several-dasds" }

  describe "#partition" do
    let(:device_name) { "/dev/dasda" }

    it "returns the single partition" do
      expect(subject.partitions.size).to eq(1)

      expect(subject.partition).to be_a(Y2Storage::Partition)
      expect(subject.partition).to eq(subject.partitions.first)
    end

    context "if there is no partition" do
      before do
        device.partition_table.delete_all_partitions
      end

      it "raises an error" do
        expect { subject.partition }.to raise_error(Y2Storage::Error)
      end
    end
  end

  describe "#free_spaces" do
    let(:device_name) { "/dev/dasda" }

    let(:partition) { subject.partition }

    context "if the single partition is in use" do
      before do
        partition.create_filesystem(Y2Storage::Filesystems::Type::EXT3)
      end

      it "returns an empty list" do
        expect(subject.free_spaces).to be_empty
      end
    end

    context "if the single partition is not in use" do
      it "returns a list with only one free space" do
        expect(subject.free_spaces.size).to eq(1)
      end

      it "returns a free space with the whole partition region" do
        expect(subject.free_spaces.first.region).to eq(partition.region)
      end

      it "returns a free space belonging to a reused partition" do
        expect(subject.free_spaces.first.reused_partition?).to eq(true)
      end
    end
  end
end
