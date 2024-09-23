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

require_relative "../../test_helper"
require_relative "storage_helpers"
require "agama/storage/actions_generator"
require "agama/storage/action"
require "y2storage"

describe Agama::Storage::ActionsGenerator do
  include Agama::RSpec::StorageHelpers

  subject { described_class.new(system_graph, staging_graph) }

  let(:system_graph) { Y2Storage::StorageManager.instance.probed }
  let(:staging_graph) { Y2Storage::StorageManager.instance.staging }

  before do
    mock_storage(devicegraph: "staging-plain-partitions.yaml")
  end

  describe "#generate" do
    before do
      # Delete home subvolume
      sda2 = staging_graph.find_by_name("/dev/sda2")
      sda2.filesystem.delete_btrfs_subvolume("home")

      # Resize sda2
      allow(sda2).to receive(:resize_info).and_return(resize_info)
      sda2.resize(Y2Storage::DiskSize.GiB(30))

      # Create new partition
      partition_table = staging_graph.find_by_name("/dev/sda").partition_table
      slot = partition_table.unused_partition_slots.first
      partition_table.create_partition("/dev/sda3", slot.region, Y2Storage::PartitionType::PRIMARY)

      # Delete sda3
      sda3 = staging_graph.find_by_name("/dev/sda3")
      partition_table.delete_partition(sda3)
    end

    let(:resize_info) do
      instance_double(
        Y2Storage::ResizeInfo, resize_ok?: true,
        min_size: Y2Storage::DiskSize.GiB(20), max_size: Y2Storage::DiskSize.GiB(40)
      )
    end

    it "generates a sorted list of actions" do
      actions = subject.generate
      expect(actions.size).to eq(4)
      expect(actions).to all(be_a(Agama::Storage::Action))
      expect(actions[0].text).to match(/Delete.*sda3/)
      expect(actions[1].text).to match(/Shrink.*sda2/)
      expect(actions[2].text).to match(/Create.*sda3/)
      expect(actions[3].text).to match(/Delete.*home/)
    end
  end
end
