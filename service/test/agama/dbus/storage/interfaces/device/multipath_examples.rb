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

shared_examples "Multipath interface" do
  describe "Multipath D-Bus interface" do
    let(:scenario) { "multipath-formatted.xml" }

    let(:device) { devicegraph.multipaths.first }

    describe "#multipath_wires" do
      it "returns the D-Bus path of the Multipath wires" do
        sda = devicegraph.find_by_name("/dev/sda")
        sdb = devicegraph.find_by_name("/dev/sdb")

        expect(subject.multipath_wires)
          .to contain_exactly(tree.path_for(sda), tree.path_for(sdb))
      end
    end
  end
end
