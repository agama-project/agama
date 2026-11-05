#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017] SUSE LLC
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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"

require "y2storage"

describe Y2Storage::Dasd do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)
  end

  subject { Y2Storage::Dasd.find_by_name(fake_devicegraph, device_name) }

  let(:scenario) { "empty_dasd_50GiB" }

  let(:device_name) { "/dev/dasda" }

  describe "#usb?" do
    it "returns false" do
      expect(subject.usb?).to be_falsey
    end
  end

  describe "#preferred_ptable_type" do
    it "returns dasd" do
      expect(subject.preferred_ptable_type).to eq Y2Storage::PartitionTables::Type::DASD
    end
  end

  describe ".all" do
    let(:scenario) { "autoyast_drive_examples" }

    it "returns a list of Y2Storage::Dasd objects" do
      dasds = Y2Storage::Dasd.all(fake_devicegraph)
      expect(dasds).to be_an Array
      expect(dasds).to all(be_a(Y2Storage::Dasd))
    end

    it "includes all dasds in the devicegraph and nothing else" do
      dasds = Y2Storage::Dasd.all(fake_devicegraph)
      expect(dasds.map(&:basename)).to contain_exactly("dasda", "dasdb")
    end
  end

  describe "#implicit_partition_table?" do
    context "if the device has no partition table" do
      let(:scenario) { "empty_dasd_50GiB" }

      let(:device_name) { "/dev/dasda" }

      it "returns false" do
        expect(subject.implicit_partition_table?).to eq(false)
      end
    end

    context "if the device has a partition table" do
      let(:scenario) { "several-dasds" }

      context "and the partition table is not implicit" do
        let(:device_name) { "/dev/dasdc" }

        it "returns false" do
          expect(subject.implicit_partition_table?).to eq(false)
        end
      end

      context "and the partition table is implicit" do
        let(:device_name) { "/dev/dasda" }

        it "returns true" do
          expect(subject.implicit_partition_table?).to eq(true)
        end
      end
    end
  end

  describe ".sorted_by_name" do
    let(:scenario) { "autoyast_drive_examples" }

    it "returns a list of Y2Storage::Dasd objects" do
      dasds = Y2Storage::Dasd.sorted_by_name(fake_devicegraph)
      expect(dasds).to be_an Array
      expect(dasds).to all(be_a(Y2Storage::Dasd))
    end

    it "includes all dasds in the devicegraph, sorted by name and nothing else" do
      dasds = Y2Storage::Dasd.sorted_by_name(fake_devicegraph)
      expect(dasds.map(&:basename)).to eq ["dasda", "dasdb"]
    end

    context "even if Dasd.all returns an unsorted array" do
      before do
        first = Y2Storage::Dasd.find_by_name(fake_devicegraph, "/dev/dasda")
        second = Y2Storage::Dasd.find_by_name(fake_devicegraph, "/dev/dasdb")
        # Inverse order
        allow(Y2Storage::Dasd).to receive(:all).and_return [second, first]
      end

      it "returns an array sorted by name" do
        dasds = Y2Storage::Dasd.sorted_by_name(fake_devicegraph)
        expect(dasds.map(&:basename)).to eq ["dasda", "dasdb"]
      end
    end
  end
end
