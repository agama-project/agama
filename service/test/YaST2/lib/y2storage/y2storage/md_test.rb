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

describe Y2Storage::Md do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  before do
    fake_scenario(scenario)
  end

  let(:scenario) { "nested_md_raids" }
  let(:md_name) { "/dev/md0" }
  subject(:md) { Y2Storage::Md.find_by_name(fake_devicegraph, md_name) }

  describe "#devices" do
    let(:scenario) { "subvolumes-and-empty-md.xml" }
    let(:md_name) { "/dev/md/strip0" }

    it "returns the array of BlkDevices used" do
      expect(md.devices).to be_an Array

      sda4 = Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/sda4")
      sda5_enc = Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/sda5").encryption
      expect(md.devices).to contain_exactly(sda4, sda5_enc)
    end
  end

  describe "#plain_devices" do
    let(:scenario) { "subvolumes-and-empty-md.xml" }
    let(:md_name) { "/dev/md/strip0" }

    it "returns the non-encrypted devices for the used BlkDevices" do
      expect(md.plain_devices).to be_an Array

      sda4 = Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/sda4")
      sda5 = Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/sda5")
      expect(md.plain_devices).to contain_exactly(sda4, sda5)
    end
  end

  describe "#md_name" do
    context "for a numeric RAID" do
      let(:scenario) { "nested_md_raids" }
      let(:md_name) { "/dev/md0" }

      it "returns nil" do
        expect(md.md_name).to be_nil
      end
    end

    context "for a named RAID" do
      let(:scenario) { "subvolumes-and-empty-md.xml" }
      let(:md_name) { "/dev/md/strip0" }

      it "returns the array name" do
        expect(md.md_name).to eq "strip0"
      end
    end
  end

  describe "#md_name=" do
    context "receiving a non-empty string" do
      it "sets the array name" do
        md.md_name = "foobar"
        expect(md.md_name).to eq "foobar"
        expect(md.name).to eq "/dev/md/foobar"
        expect(md.numeric?).to eq false
      end
    end

    context "receiving an empty string" do
      it "raises an error" do
        expect { md.md_name = "" }.to raise_error ArgumentError
      end
    end

    context "receiving nil" do
      it "raises an error" do
        expect { md.md_name = nil }.to raise_error ArgumentError
      end
    end
  end

  describe "#numeric?" do

    it "returns true for /dev/md0" do
      expect(md.numeric?).to eq true
    end

  end

  describe "#number" do

    it "returns 0 for /dev/md0" do
      expect(md.number).to eq 0
    end

  end

  describe "#md_level" do

    it "returns the MD RAID level" do
      expect(md.md_level).to eq Y2Storage::MdLevel::RAID0
    end
  end

  describe "#md_level=" do

    it "set the MD RAID level" do
      md.md_level = Y2Storage::MdLevel::RAID1
      expect(md.md_level).to eq Y2Storage::MdLevel::RAID1
    end

  end

  describe "#md_parity" do

    it "returns the MD RAID parity" do
      expect(md.md_parity).to eq Y2Storage::MdParity::DEFAULT
    end

  end

  describe "#chunk_size" do

    it "returns the MD RAID chunk size" do
      expect(md.chunk_size).to eq 512.KiB
    end
  end

  describe "#chunk_size=" do

    it "sets the MD RAID chunk size" do
      md.chunk_size = 256.KiB
      expect(md.chunk_size).to eq 256.KiB
    end

  end

  describe "#uuid" do

    it "returns the MD RAID UUID" do
      expect(md.uuid).to eq "d11cbd17:b4fa9ccd:bb7b9bab:557d863c"
    end

  end

  describe "#metadata" do

    it "returns the MD RAID metadata as a string" do
      expect(md.metadata).to eq "1.0"
    end

  end

  describe "#in_etc_mdadm" do

    it "returns false since the MD RAID is not in /etc/mdadm.conf" do
      expect(md.in_etc_mdadm?).to eq false
    end

  end

  describe "#inspect" do

    it "inspects a MD object" do
      expect(md.inspect).to eq "<Md /dev/md0 16220688 KiB (15.47 GiB) raid0>"
    end

  end

  describe "#is?" do

    it "returns true for values whose symbol is :md" do
      expect(md.is?(:md)).to eq true
      expect(md.is?("md")).to eq true
    end

    it "returns false for a different string like \"Md\"" do
      expect(md.is?("Md")).to eq false
    end

    it "returns false for different device names like :partition or :filesystem" do
      expect(md.is?(:partition)).to eq false
      expect(md.is?(:filesystem)).to eq false
    end

  end

  describe ".find_free_numeric_name" do

    it "returns the next free number MD RAID name" do
      expect(Y2Storage::Md.find_free_numeric_name(fake_devicegraph)).to eq "/dev/md3"
    end

  end

  describe "#software_defined?" do
    before do
      mock_env(env_vars)
    end

    let(:env_vars) { {} }

    context "when the MD RAID is probed" do
      context "and LIBSTORAGE_MDPART was not activated on boot" do
        let(:env_vars) { { "LIBSTORAGE_MDPART" => "no" } }

        it "returns true" do
          expect(md.software_defined?).to eq(true)
        end
      end

      context "and LIBSTORAGE_MDPART was activated on boot" do
        let(:env_vars) { { "LIBSTORAGE_MDPART" => "1" } }

        it "returns false" do
          expect(md.software_defined?).to eq(false)
        end
      end
    end

    context "when the MD RAID is not probed" do
      let(:devicegraph) { Y2Storage::StorageManager.instance.staging }

      subject(:md) { Y2Storage::Md.create(devicegraph, "/dev/md10") }

      # Even when the env variable is set
      let(:env_vars) { { "LIBSTORAGE_MDPART" => "1" } }

      it "returns true" do
        expect(md.software_defined?).to eq(true)
      end
    end

    context "if the RAID is a MD Member (BIOS RAID)" do
      subject(:md) { Y2Storage::MdMember.create(fake_devicegraph, "/dev/md10") }

      it "returns false" do
        expect(md.software_defined?).to eq(false)
      end
    end

    context "if the RAID is a MD Container" do
      subject(:md) { Y2Storage::MdContainer.create(fake_devicegraph, "/dev/md/imsm0") }

      it "returns false" do
        expect(md.software_defined?).to eq(false)
      end
    end
  end

  describe "#is?" do
    context "when the MD is software defined" do
      before do
        allow(subject).to receive(:software_defined?).and_return(true)
      end

      it "returns false for values whose symbol is :disk_device" do
        expect(subject.is?(:disk_device)).to eq false
        expect(subject.is?("disk_device")).to eq false
      end
    end

    context "when the MD is not software defined" do
      before do
        allow(subject).to receive(:software_defined?).and_return(false)
      end

      it "returns true for values whose symbol is :disk_device" do
        expect(subject.is?(:disk_device)).to eq true
        expect(subject.is?("disk_device")).to eq true
      end
    end

    it "returns true for values whose symbol is :md" do
      expect(subject.is?(:md)).to eq true
      expect(subject.is?("md")).to eq true
    end

    it "returns true for values whose symbol is :raid" do
      expect(subject.is?(:raid)).to eq true
      expect(subject.is?("raid")).to eq true
    end

    it "returns true for values whose symbol is :software_raid" do
      expect(subject.is?(:software_raid)).to eq true
      expect(subject.is?("software_raid")).to eq true
    end

    it "returns false for values whose symbol is :bios_raid" do
      expect(subject.is?(:bios_raid)).to eq false
      expect(subject.is?("bios_raid")).to eq false
    end

    it "returns false for different device names like :disk" do
      expect(subject.is?(:disk)).to eq false
    end
  end
end
