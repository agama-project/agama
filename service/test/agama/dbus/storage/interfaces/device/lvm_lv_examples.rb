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

shared_examples "LVM.LogicalVolume interface" do
  describe "LVM.LogicalVolume D-Bus interface" do
    let(:scenario) { "trivial_lvm.yml" }

    let(:device) { devicegraph.find_by_name("/dev/vg0/lv1") }

    describe "#lvm_lv_vg" do
      it "returns the path of the host volume group" do
        vg0 = devicegraph.find_by_name("/dev/vg0")

        expect(subject.lvm_lv_vg).to eq(tree.path_for(vg0))
      end
    end
  end
end
