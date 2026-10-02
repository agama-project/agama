#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2019] SUSE LLC
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
require_relative "../../support/shared_setup"
require "y2storage"

describe Y2Storage::Proposal::AutoinstPartitioner do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject(:partitioner) { described_class.new(fake_devicegraph) }

  before do
    fake_scenario(scenario)
  end

  let(:partitions) { [root] }
  let(:root) do
    planned_partition(
      mount_point: "/", type: Y2Storage::Filesystems::Type::BTRFS, min_size: 1.GiB, max_size: 1.GiB
    )
  end

  describe "#reuse_device_partitions" do
    context "for a bcache device" do
      let(:scenario) { "bcache1.xml" }
      let(:real_bcache) { fake_devicegraph.bcaches.first }

      let(:planned_bcache0) do
        planned_bcache(name: "/dev/bcache0", partitions: partitions)
      end

      before do
        planned_bcache0.reuse_name = real_bcache.name
        root.reuse_name = "/dev/bcache0p1"
      end

      it "reuses the partitions" do
        devicegraph = partitioner.reuse_device_partitions(planned_bcache0).devicegraph
        reused_bcache = devicegraph.bcaches.first
        mount_point = reused_bcache.partitions.first.mount_point
        expect(mount_point.path).to eq("/")
      end
    end

    context "for a MD RAID" do
      let(:scenario) { "partitioned_md_raid.xml" }
      let(:real_md) { fake_devicegraph.md_raids.first }

      let(:planned_md0) do
        planned_md(name: "/dev/md0", partitions: partitions)
      end

      before do
        planned_md0.reuse_name = real_md.name
        root.reuse_name = "/dev/md/md0p1"
      end

      it "reuses the partitions" do
        devicegraph = partitioner.reuse_device_partitions(planned_md0).devicegraph
        reused_md = devicegraph.md_raids.first
        mount_point = reused_md.partitions.first.mount_point
        expect(mount_point.path).to eq("/")
      end
    end
  end
end
