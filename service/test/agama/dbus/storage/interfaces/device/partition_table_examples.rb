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
require "y2storage/disk_size"
require "y2storage/partition_tables/partition_slot"
require "y2storage/region"

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

    describe "#partition_table_unused_slots" do
      before do
        allow(device).to receive(:partition_table).and_return(partition_table)
        allow(partition_table).to receive(:unused_partition_slots).and_return(unused_slots)
      end

      let(:partition_table) { device.partition_table }

      let(:unused_slots) do
        [
          instance_double(Y2Storage::PartitionTables::PartitionSlot, region: region1),
          instance_double(Y2Storage::PartitionTables::PartitionSlot, region: region2)
        ]
      end

      let(:region1) do
        instance_double(Y2Storage::Region, start: 234, size: Y2Storage::DiskSize.new(1024))
      end

      let(:region2) do
        instance_double(Y2Storage::Region, start: 987, size: Y2Storage::DiskSize.new(2048))
      end

      it "returns the information about the unused slots" do
        md0p1 = devicegraph.find_by_name("/dev/md0p1")
        expect(subject.partition_table_unused_slots).to contain_exactly([234, 1024], [987, 2048])
      end
    end
  end
end
