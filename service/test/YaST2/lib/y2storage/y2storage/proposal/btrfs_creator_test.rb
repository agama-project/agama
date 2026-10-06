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

describe Y2Storage::Proposal::BtrfsCreator do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)
  end

  subject { described_class.new(fake_devicegraph) }

  describe "#create_filesystem" do
    let(:planned_filesystem) do
      planned_btrfs(
        "root_fs",
        data_raid_level:     single,
        metadata_raid_level: raid0,
        mount_point:         "/",
        uuid:                "111-222-333"
      )
    end

    let(:planned_partition1) do
      planned_partition(device: btrfs_device1, btrfs_name: "root_fs", create: false)
    end

    let(:planned_partition2) do
      planned_partition(device: btrfs_device2, btrfs_name: "root_fs", create: false)
    end

    let(:single) { Y2Storage::BtrfsRaidLevel::SINGLE }

    let(:raid0) { Y2Storage::BtrfsRaidLevel::RAID0 }

    let(:scenario) { "mixed_disks" }

    let(:btrfs_device1) { "/dev/sda1" }

    let(:btrfs_device2) { "/dev/sda2" }

    let(:btrfs_devices) { [btrfs_device1, btrfs_device2] }

    it "creates a new Btrfs filesystem" do
      btrfs_count = fake_devicegraph.btrfs_filesystems.size

      result = subject.create_filesystem(planned_filesystem, btrfs_devices)
      devicegraph = result.devicegraph

      expect(devicegraph.btrfs_filesystems.size).to eq(btrfs_count + 1)

      expect(devicegraph.btrfs_filesystems).to include(
        an_object_having_attributes(mount_path: "/", uuid: "111-222-333")
      )
    end

    it "adds the given devices to the new Btrfs" do
      result = subject.create_filesystem(planned_filesystem, btrfs_devices)
      devicegraph = result.devicegraph

      filesystem = devicegraph.btrfs_filesystems.find { |f| f.uuid == "111-222-333" }

      expect(filesystem.blk_devices.map(&:name)).to contain_exactly(*btrfs_devices)
    end

    it "sets the given raid levels for data and metadata" do
      result = subject.create_filesystem(planned_filesystem, btrfs_devices)
      devicegraph = result.devicegraph

      filesystem = devicegraph.btrfs_filesystems.find { |f| f.uuid == "111-222-333" }

      expect(filesystem.data_raid_level).to eq(single)
      expect(filesystem.metadata_raid_level).to eq(raid0)
    end
  end

  describe "#reuse_filesystem" do
    let(:scenario) { "btrfs2-devicegraph.xml" }

    let(:planned_filesystem) do
      planned_btrfs("root_fs", mount_point: "/foo", reuse_sid: filesystem_sid)
    end

    let(:filesystem_sid) { fake_devicegraph.find_by_name("/dev/sdb1").filesystem.sid }

    it "reuses the existing filesystem" do
      filesystem = fake_devicegraph.find_by_name("/dev/sdb1").filesystem

      expect(filesystem.mount_path).to_not eq("/foo")

      result = subject.reuse_filesystem(planned_filesystem)
      devicegraph = result.devicegraph

      filesystem = devicegraph.find_by_name("/dev/sdb1").filesystem

      expect(filesystem.mount_path).to eq("/foo")
    end
  end
end
