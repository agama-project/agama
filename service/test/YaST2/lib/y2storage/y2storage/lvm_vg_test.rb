#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2021] SUSE LLC
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

describe Y2Storage::LvmVg do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  before do
    fake_scenario(scenario)
  end

  let(:scenario) { "complex-lvm-encrypt" }

  subject(:vg) { Y2Storage::LvmVg.find_by_vg_name(fake_devicegraph, vg_name) }

  let(:vg_name) { "vg0" }

  describe "#name" do
    it "returns string starting with /dev and containing vg_name" do
      subject = Y2Storage::StorageManager.instance.staging.lvm_vgs.first
      expect(subject.name).to start_with("/dev")
      expect(subject.name).to include(subject.vg_name)
    end
  end

  describe ".sorted_by_name" do
    it "returns all the volume groups sorted by name" do
      devices = Y2Storage::LvmVg.sorted_by_name(fake_devicegraph)
      expect(devices.map(&:basename)).to eq ["vg0", "vg1"]
    end
  end

  describe "lvm_lvs" do
    before do
      create_thin_provisioning(vg)
    end

    it "includes all normal volumes" do
      expect(vg.lvm_lvs.map(&:lv_name)).to include("lv1", "lv2")
    end

    it "includes all thin pools" do
      expect(vg.lvm_lvs.map(&:lv_name)).to include("pool1", "pool2")
    end

    it "does not include thin volumes" do
      expect(vg.lvm_lvs.map(&:lv_name)).to_not include("thin1", "thin2", "thin3")
    end
  end

  describe "all_lvm_lvs" do
    before do
      create_thin_provisioning(vg)
    end

    it "includes all normal volumes" do
      expect(vg.all_lvm_lvs.map(&:lv_name)).to include("lv1", "lv2")
    end

    it "includes all thin pools" do
      expect(vg.all_lvm_lvs.map(&:lv_name)).to include("pool1", "pool2")
    end

    it "includes all thin volumes" do
      expect(vg.all_lvm_lvs.map(&:lv_name)).to include("thin1", "thin2", "thin3")
    end
  end

  describe "thin_pool_lvm_lvs" do
    before do
      create_thin_provisioning(vg)
    end

    it "includes all thin pools" do
      expect(vg.thin_pool_lvm_lvs.map(&:lv_name)).to include("pool1", "pool2")
    end

    it "does not include normal volumes" do
      expect(vg.thin_pool_lvm_lvs.map(&:lv_name)).to_not include("lv1", "lv2")
    end

    it "does not include thin volumes" do
      expect(vg.thin_pool_lvm_lvs.map(&:lv_name)).to_not include("thin1", "thin2", "thin3")
    end
  end

  describe "thin_lvm_lvs" do
    before do
      create_thin_provisioning(vg)
    end

    it "includes all thin volumes" do
      expect(vg.thin_lvm_lvs.map(&:lv_name)).to include("thin1", "thin2", "thin3")
    end

    it "does not include normal volumes" do
      expect(vg.thin_lvm_lvs.map(&:lv_name)).to_not include("lv1", "lv2")
    end

    it "does not include thin pools" do
      expect(vg.thin_lvm_lvs.map(&:lv_name)).to_not include("pool1", "pool2")
    end
  end

  describe "#delete_lvm_lv" do
    context "in a VG with snapshots" do
      let(:scenario) { "lvm-types1.xml" }

      it "deletes the snapshots of the removed LV" do
        normal1 = vg.lvm_lvs.find { |lv| lv.lv_name == "normal1" }

        expect(vg.lvm_lvs.map(&:lv_name)).to include("normal1", "snap_normal1")
        vg.delete_lvm_lv(normal1)
        expect(vg.lvm_lvs.map(&:lv_name)).to_not include "normal1"
        expect(vg.lvm_lvs.map(&:lv_name)).to_not include "snap_normal1"
      end
    end
  end

  describe "#max_size_for_striped_lv" do
    let(:scenario) { "lvm_several_pvs" }

    # Pv sizes are 2 GiB, 1 GiB and 5 GiB
    let(:vg_name) { "vg0" }

    let(:pv1) { vg.lvm_pvs.find { |p| p.blk_device.name == "/dev/sda1" } } # 2 GiB
    let(:pv2) { vg.lvm_pvs.find { |p| p.blk_device.name == "/dev/sda2" } } # 1 GiB
    let(:pv3) { vg.lvm_pvs.find { |p| p.blk_device.name == "/dev/sda3" } } # 1 GiB

    it "returns a disk size" do
      expect(vg.max_size_for_striped_lv(2)).to be_a(Y2Storage::DiskSize)
    end

    it "returns the maximum size for a stripped volume with the given number of stripes" do
      expect(vg.max_size_for_striped_lv(2)).to eq(pv1.usable_size * 2)
      expect(vg.max_size_for_striped_lv(3)).to eq(pv2.usable_size * 3)
    end

    context "when the given number of stripes is not valid" do
      it "raises an error" do
        expect { vg.max_size_for_striped_lv(1) }.to raise_error(ArgumentError)
      end
    end

    context "when the given number of stripes is bigger than the number of physical volumes" do
      it "returns nil" do
        expect(vg.max_size_for_striped_lv(10)).to be_nil
      end
    end
  end

  describe "#size_for_striped_lv?" do
    let(:scenario) { "lvm_several_pvs" }

    # Pv sizes are 1 GiB, 2 GiB and 5 GiB
    let(:vg_name) { "vg0" }

    context "when the given size is bigger than the volume group size" do
      it "returns false" do
        expect(vg.size_for_striped_lv?(10.GiB, 2)).to eq(false)
      end
    end

    context "when the given number of stripes is not valid" do
      it "raises an error" do
        expect { vg.size_for_striped_lv?(1.GiB, 1) }.to raise_error(ArgumentError)
      end
    end

    context "when the given number of stripes is bigger than the number of physcial volumes" do
      it "returns false" do
        expect(vg.size_for_striped_lv?(4.GiB, 4)).to eq(false)
      end
    end

    context "when the given number of stripes is not bigger than the number of physcial volumes" do
      context "and the physical volumes are big enough to allocate the required size" do
        it "returns true" do
          expect(vg.size_for_striped_lv?(3.5.GiB, 2)).to eq(true)
          expect(vg.size_for_striped_lv?(1.5.GiB, 3)).to eq(true)
        end
      end

      context "and the physical volumes are not big enough to allocate the required size" do
        it "returns false" do
          expect(vg.size_for_striped_lv?(5.GiB, 2)).to eq(false)
          expect(vg.size_for_striped_lv?(4.GiB, 3)).to eq(false)
        end
      end
    end
  end

  describe "#pv_size_for_striped_lv" do
    let(:scenario) { "lvm_several_pvs" }

    # Pv sizes are 2 GiB, 1 GiB and 5 GiB
    let(:vg_name) { "vg0" }

    let(:pv1) { vg.lvm_pvs.find { |p| p.blk_device.name == "/dev/sda1" } } # 2 GiB
    let(:pv2) { vg.lvm_pvs.find { |p| p.blk_device.name == "/dev/sda2" } } # 1 GiB
    let(:pv3) { vg.lvm_pvs.find { |p| p.blk_device.name == "/dev/sda3" } } # 1 GiB

    it "returns a disk size" do
      expect(vg.pv_size_for_striped_lv(2)).to be_a(Y2Storage::DiskSize)
    end

    it "returns the usable size of the n-th biggest pv according to the given number of stripes" do
      expect(vg.pv_size_for_striped_lv(2)).to eq(pv1.usable_size)
      expect(vg.pv_size_for_striped_lv(3)).to eq(pv2.usable_size)
    end

    context "when the given number of stripes is not valid" do
      it "raises an error" do
        expect { vg.pv_size_for_striped_lv(1) }.to raise_error(ArgumentError)
      end
    end

    context "when the given number of stripes is bigger than the number of physical volumes" do
      it "returns nil" do
        expect(vg.pv_size_for_striped_lv(10)).to be_nil
      end
    end
  end
end
