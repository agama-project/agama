# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

shared_examples "LVM.VolumeGroup interface" do
  describe "LVM.VolumeGroup D-Bus interface" do
    let(:scenario) { "trivial_lvm.yml" }

    let(:device) { devicegraph.find_by_name("/dev/vg0") }

    describe "#lvm_vg_name" do
      it "returns the name of the volume group" do
        expect(subject.lvm_vg_name).to eq("/dev/vg0")
      end
    end

    describe "#lvm_vg_size" do
      before do
        allow(device).to receive(:size).and_return(size)
      end

      let(:size) { Y2Storage::DiskSize.new(1024) }

      it "returns the size in bytes" do
        expect(subject.lvm_vg_size).to eq(1024)
      end
    end

    describe "#lvm_vg_pvs" do
      it "returns the D-Bus path of the physical volumes" do
        sda1 = devicegraph.find_by_name("/dev/sda1")

        expect(subject.lvm_vg_pvs).to contain_exactly(tree.path_for(sda1))
      end
    end

    describe "#lvm_vg_lvs" do
      it "returns the D-Bus path of the logical volumes" do
        lv1 = devicegraph.find_by_name("/dev/vg0/lv1")

        expect(subject.lvm_vg_lvs).to contain_exactly(tree.path_for(lv1))
      end
    end
  end
end
