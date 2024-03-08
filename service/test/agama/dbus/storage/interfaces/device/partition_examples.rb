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

shared_examples "Partition interface" do
  describe "Partition D-Bus interface" do
    let(:scenario) { "partitioned_md.yml" }

    let(:device) { devicegraph.find_by_name("/dev/sda1") }

    describe "#partition_device" do
      it "returns the path of the host device" do
        sda = devicegraph.find_by_name("/dev/sda")

        expect(subject.partition_device).to eq(tree.path_for(sda))
      end
    end

    describe "#partition_efi" do
      before do
        allow(device).to receive(:efi_system?).and_return(true)
      end

      it "returns whether it is an EFI partition" do
        expect(subject.partition_efi).to eq(true)
      end
    end
  end
end
