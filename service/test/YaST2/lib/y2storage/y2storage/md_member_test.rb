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

describe Y2Storage::MdMember do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)
  end

  let(:scenario) { "mixed_disks" }

  let(:devicegraph) { fake_devicegraph }

  subject { described_class.create(devicegraph, "/dev/md0") }

  describe ".all" do
    before do
      Y2Storage::MdMember.create(devicegraph, "/dev/md0")
      Y2Storage::MdMember.create(devicegraph, "/dev/md/1")
      Y2Storage::Md.create(devicegraph, "/dev/md2")
    end

    it "includes all BIOS MD RAIDs" do
      expect(described_class.all(devicegraph).map(&:name)).to contain_exactly("/dev/md0",
        "/dev/md/1")
    end
  end

  describe "#software_defined?" do
    it "returns false" do
      expect(subject.software_defined?).to eq(false)
    end
  end

  # bsc#1067349
  describe "#usb?" do
    it "returns false" do
      expect(subject.usb?).to eq(false)
    end
  end

  describe "#is?" do
    let(:scenario) { "md-imsm1-devicegraph.xml" }

    subject { devicegraph.md_member_raids.first }

    it "returns true for values whose symbol is :disk_device" do
      expect(subject.is?(:disk_device)).to eq true
      expect(subject.is?("disk_device")).to eq true
    end

    it "returns true for values whose symbol is :md_member" do
      expect(subject.is?(:md_member)).to eq true
      expect(subject.is?("md_member")).to eq true
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

    it "returns false for different device names like :disk" do
      expect(subject.is?(:disk)).to eq false
    end
  end
end
