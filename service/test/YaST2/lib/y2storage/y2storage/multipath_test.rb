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

describe Y2Storage::Multipath do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)
  end
  let(:scenario) { "empty-dasd-and-multipath.xml" }
  let(:dev_name) { "/dev/mapper/36005076305ffc73a00000000000013b4" }
  subject(:multipath) { described_class.find_by_name(fake_devicegraph, dev_name) }

  describe "#preferred_ptable_type" do
    it "returns gpt" do
      expect(subject.preferred_ptable_type).to eq Y2Storage::PartitionTables::Type::GPT
    end
  end

  describe "#partition_table" do
    context "for a device with a partition table" do
      let(:dev_name) { "/dev/mapper/36005076305ffc73a00000000000013b4" }

      it "returns the corresponding PartitionTable object" do
        expect(multipath.partition_table).to be_a Y2Storage::PartitionTables::Base
        expect(multipath.partition_table.partitionable).to eq multipath
      end
    end

    context "for a completely empty multipath device" do
      let(:dev_name) { "/dev/mapper/36005076305ffc73a00000000000013b5" }

      it "returns nil" do
        expect(multipath.partition_table).to be_nil
      end
    end
  end

  describe "#is?" do
    it "returns true for values whose symbol is :multipath" do
      expect(multipath.is?(:multipath)).to eq true
      expect(multipath.is?("multipath")).to eq true
    end

    it "returns false for a different string like \"MultiPath\"" do
      expect(multipath.is?("MultiPath")).to eq false
    end

    it "returns false for different device names like :disk or :partition" do
      expect(multipath.is?(:disk)).to eq false
      expect(multipath.is?(:partition)).to eq false
    end

    it "returns true for a list of names containing :multipath" do
      expect(multipath.is?(:multipath, :partition)).to eq true
    end

    it "returns false for a list of names not containing :multipath" do
      expect(multipath.is?(:disk, :dasd, :partition)).to eq false
    end
  end

  describe "#parents" do
    it "returns the disks grouped in the multipath device" do
      expect(multipath.parents).to all(be_a(Y2Storage::Disk))
      expect(multipath.parents.map(&:name)).to contain_exactly("/dev/sda", "/dev/sdc")
    end
  end

  describe "#in_network?" do
    context "if none of the disks in the device is a network device" do
      let(:dev_name) { "/dev/mapper/36005076305ffc73a00000000000013b4" }

      it "returns false" do
        expect(multipath.in_network?).to eq false
      end
    end

    context "if any of the disks in the device is a network device" do
      # /dev/sdb is FCoE
      let(:dev_name) { "/dev/mapper/36005076305ffc73a00000000000013b5" }

      it "returns true" do
        expect(multipath.in_network?).to eq true
      end
    end
  end
end
