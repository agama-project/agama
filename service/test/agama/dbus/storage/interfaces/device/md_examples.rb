# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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

shared_examples "MD interface" do
  describe "MD D-Bus interface" do
    let(:scenario) { "partitioned_md.yml" }

    let(:device) { devicegraph.md_raids.first }

    describe "#md_uuid" do
      before do
        allow(device).to receive(:uuid).and_return(uuid)
      end

      let(:uuid) { "12345-abcde" }

      it "returns the UUID of the MD" do
        expect(subject.md_uuid).to eq(uuid)
      end
    end

    describe "#md_level" do
      it "returns the RAID level" do
        expect(subject.md_level).to eq("raid0")
      end
    end

    describe "#md_devices" do
      it "returns the D-Bus path of the MD components" do
        sda1 = devicegraph.find_by_name("/dev/sda1")
        sda2 = devicegraph.find_by_name("/dev/sda2")

        expect(subject.md_devices)
          .to contain_exactly(tree.path_for(sda1), tree.path_for(sda2))
      end
    end
  end
end
