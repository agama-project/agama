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

require_relative "../../../../test_helper"

shared_examples "Component interface" do
  describe "Component D-Bus interface" do
    let(:scenario) { "empty-dm_raids.xml" }

    let(:device) { devicegraph.find_by_name("/dev/sdb") }

    describe "#component_type" do
      it "returns the type of component" do
        expect(subject.component_type).to eq("raid_device")
      end
    end

    describe "#component_devices" do
      it "returns the D-Bus path of the devices for which the device is component" do
        raid1 = devicegraph.find_by_name("/dev/mapper/isw_ddgdcbibhd_test1")
        raid2 = devicegraph.find_by_name("/dev/mapper/isw_ddgdcbibhd_test2")

        expect(subject.component_devices)
          .to contain_exactly(tree.path_for(raid1), tree.path_for(raid2))
      end
    end
  end
end
