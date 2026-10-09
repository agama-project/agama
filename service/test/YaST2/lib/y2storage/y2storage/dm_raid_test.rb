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

describe Y2Storage::DmRaid do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)
  end
  let(:scenario) { "empty-dm_raids.xml" }
  let(:dev_name) { "/dev/mapper/isw_ddgdcbibhd_test1" }
  subject(:dm_raid) { described_class.find_by_name(fake_devicegraph, dev_name) }

  describe "#preferred_ptable_type" do
    it "returns gpt" do
      expect(subject.preferred_ptable_type).to eq Y2Storage::PartitionTables::Type::GPT
    end
  end

  describe "#partition_table" do
    context "for a device with a partition table" do
      let(:dev_name) { "/dev/mapper/isw_ddgdcbibhd_test1" }

      it "returns the corresponding PartitionTable object" do
        expect(dm_raid.partition_table).to be_a Y2Storage::PartitionTables::Base
        expect(dm_raid.partition_table.partitionable).to eq dm_raid
      end
    end

    context "for a completely empty DM RAID" do
      let(:dev_name) { "/dev/mapper/isw_ddgdcbibhd_test2" }

      it "returns nil" do
        expect(dm_raid.partition_table).to be_nil
      end
    end
  end

  describe "#is?" do
    it "returns true for values whose symbol is :dm_raid" do
      expect(dm_raid.is?(:dm_raid)).to eq true
      expect(dm_raid.is?("dm_raid")).to eq true
    end

    it "returns false for a different string like \"DM_RAID\"" do
      expect(dm_raid.is?("DM_RAID")).to eq false
    end

    it "returns true for values whose symbol is :raid" do
      expect(subject.is?(:raid)).to eq true
      expect(subject.is?("raid")).to eq true
    end

    it "returns true for values whose symbol is :bios_raid" do
      expect(subject.is?(:bios_raid)).to eq true
      expect(subject.is?("bios_raid")).to eq true
    end

    it "returns false for values whose symbol is :software_raid" do
      expect(subject.is?(:software_raid)).to eq false
      expect(subject.is?("software_raid")).to eq false
    end

    it "returns false for different device names like :disk or :partition" do
      expect(dm_raid.is?(:disk)).to eq false
      expect(dm_raid.is?(:partition)).to eq false
    end

    it "returns true for a list of names containing :dm_raid" do
      expect(dm_raid.is?(:dm_raid, :multipath)).to eq true
    end

    it "returns false for a list of names not containing :dm_raid" do
      expect(dm_raid.is?(:disk, :dasd, :multipath)).to eq false
    end
  end

  describe "#parents" do
    it "returns the disks grouped in the DM RAID" do
      expect(dm_raid.parents).to all(be_a(Y2Storage::Disk))
      expect(dm_raid.parents.map(&:name)).to contain_exactly("/dev/sdb", "/dev/sdc")
    end
  end

  describe "#software_defined?" do
    it "returns false" do
      expect(dm_raid.software_defined?).to eq(false)
    end
  end
end
