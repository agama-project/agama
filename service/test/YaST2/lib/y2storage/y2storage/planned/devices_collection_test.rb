#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2018-2019] SUSE LLC
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

require "y2storage/planned"

describe Y2Storage::Planned::DevicesCollection do
  include_context "yast2-storage-ng test setup"

  subject(:collection) { described_class.new(devices) }

  let(:partition) { planned_partition }
  let(:disk_partition) { planned_partition }
  let(:md_partition) { planned_partition }
  let(:bcache_partition) { planned_partition }
  let(:disk) { planned_disk(partitions: [disk_partition]) }
  let(:stray_blk_device) { planned_stray_blk_device }
  let(:md) { planned_md(partitions: [md_partition]) }
  let(:lv0) { planned_lv(mount_point: "/") }
  let(:lv1) { planned_lv }
  let(:vg) { planned_vg(lvs: [lv0, lv1]) }
  let(:bcache) { planned_bcache(partitions: [bcache_partition]) }
  let(:btrfs) { planned_btrfs("root_fs") }
  let(:nfs) { planned_nfs }
  let(:devices) { [partition, disk, stray_blk_device, md, bcache, vg, btrfs, nfs] }

  describe "#devices" do
    context "when there are no planned devices" do
      let(:devices) { [] }

      it "returns an empty array" do
        expect(subject.devices).to eq([])
      end
    end
  end

  describe "#append" do
    let(:devices) { [disk] }

    it "adds devices at the end of the collection" do
      new_collection = collection.append([md])
      expect(new_collection.devices).to eq([disk, md])
    end
  end

  describe "#append" do
    let(:devices) { [disk] }

    it "adds devices at the beginning of the collection" do
      new_collection = collection.prepend([md])
      expect(new_collection.devices).to eq([md, disk])
    end

  end

  describe "#all" do
    it "returns all planned devices" do
      expect(collection.all).to contain_exactly(
        partition, disk_partition, disk, stray_blk_device, md, md_partition, lv0, lv1, vg, bcache,
        bcache_partition, btrfs, nfs
      )
    end
  end

  describe "#partitions" do
    it "returns planned partitions" do
      expect(collection.partitions).to eq([partition, disk_partition, md_partition, bcache_partition])
    end
  end

  describe "#disk_partitions" do
    it "returns planned partitions" do
      expect(collection.disk_partitions).to eq([partition, disk_partition])
    end
  end

  describe "#md_partitions" do
    it "returns planned partitions" do
      expect(collection.md_partitions).to eq([md_partition])
    end
  end

  describe "#disks" do
    it "returns disks" do
      expect(collection.disks).to eq([disk])
    end
  end

  describe "#stray_blk_devices" do
    it "returns disks" do
      expect(collection.stray_blk_devices).to eq([stray_blk_device])
    end
  end

  describe "#vgs" do
    it "returns volume groups" do
      expect(collection.vgs).to eq([vg])
    end
  end

  describe "#mds" do
    it "returns MD RAID devices" do
      expect(collection.mds).to eq([md])
    end
  end

  describe "#bcaches" do
    it "returns bcache devices" do
      expect(collection.bcaches).to eq([bcache])
    end
  end

  describe "#btrfs_filesystems" do
    it "returns Btrfs filesystems" do
      expect(collection.btrfs_filesystems).to eq([btrfs])
    end
  end

  describe "#nfs_filesystems" do
    it "returns NFS filesystems" do
      expect(collection.nfs_filesystems).to eq([nfs])
    end
  end

  describe "#mountable_devices" do
    it "returns all devices that can be mounted" do
      expect(collection.mountable_devices).to contain_exactly(
        partition, disk, disk_partition, stray_blk_device, lv0, lv1, md, md_partition,
        bcache, bcache_partition, btrfs, nfs
      )
    end
  end

  describe "#each" do
    it "yields each element" do
      expect { |b| subject.each(&b) }.to yield_successive_args(*subject.all)
    end
  end
end
