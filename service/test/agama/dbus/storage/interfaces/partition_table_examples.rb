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

require_relative "../../../../test_helper"

shared_examples "PartitionTable interface" do
  describe "PartitionTable D-Bus interface" do
    let(:scenario) { "partitioned_md.yml" }

    let(:device) { devicegraph.find_by_name("/dev/md0") }

    describe "#partition_table_type" do
      it "returns the partition table type" do
        expect(subject.partition_table_type).to eq("msdos")
      end
    end

    describe "#partition_table_partitions" do
      it "returns the path of the partitions" do
        md0p1 = devicegraph.find_by_name("/dev/md0p1")
        expect(subject.partition_table_partitions).to contain_exactly(tree.path_for(md0p1))
      end
    end
  end
end
