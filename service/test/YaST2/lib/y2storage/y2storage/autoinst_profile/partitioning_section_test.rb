#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2019] SUSE LLC
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

describe Y2Storage::AutoinstProfile::PartitioningSection do
  include_context "yast2-storage-ng test setup"

  subject(:section) { described_class.new }

  let(:sda) { { "device" => "/dev/sda", "use" => "linux" } }
  let(:sdb) { { "device" => "/dev/sdb", "use" => "all" } }
  let(:disk_section) { double("disk_section", type: :CT_DISK) }
  let(:dasd_section) { double("dasd_section", type: :CT_DISK) }
  let(:vg_section) { double("vg_section", type: :CT_LVM) }
  let(:md_section) { double("md_section", type: :CT_MD) }
  let(:stray_section) { double("stray_section", type: :CT_DISK) }
  let(:bcache_section) { double("bcache_section", type: :CT_BCACHE) }
  let(:nfs_section) { double("nfs_section", type: :CT_NFS) }
  let(:btrfs_section) { double("btrfs_section", type: :CT_BTRFS) }
  let(:tmpfs0_section) do
    Y2Storage::AutoinstProfile::DriveSection.new_from_hashes(
      "type" => :CT_TMPFS, "partitions" => [{ "mount" => "/srv" }]
    )
  end
  let(:tmpfs1_section) do
    Y2Storage::AutoinstProfile::DriveSection.new_from_hashes(
      "type" => :CT_TMPFS, "partitions" => [{ "mount" => "/var/tmp" }]
    )
  end
  let(:partitioning) { [sda, sdb] }

  describe ".new_from_hashes" do
    before do
      allow(Y2Storage::AutoinstProfile::DriveSection).to receive(:new_from_hashes)
        .with(sda, Y2Storage::AutoinstProfile::PartitioningSection).and_return(disk_section)
      allow(Y2Storage::AutoinstProfile::DriveSection).to receive(:new_from_hashes)
        .with(sdb, Y2Storage::AutoinstProfile::PartitioningSection).and_return(dasd_section)
    end

    it "returns a new PartitioningSection object" do
      expect(described_class.new_from_hashes(partitioning)).to be_a(described_class)
    end

    it "creates an entry in #drives for every valid hash in the array" do
      section = described_class.new_from_hashes(partitioning)
      expect(section.drives).to eq([disk_section, dasd_section])
    end

    # In fact, I don't think DriveSection.new_from_hashes can return nil, but
    # just in case...
    it "ignores hashes that couldn't be converted into DriveSection objects" do
      allow(Y2Storage::AutoinstProfile::DriveSection).to receive(:new_from_hashes)
        .with(sda, Y2Storage::AutoinstProfile::PartitioningSection).and_return(nil)

      section = described_class.new_from_hashes(partitioning)
      expect(section.drives).to eq([dasd_section])
    end
  end

  describe ".new_from_storage" do
    describe "using doubles for the devicegraph and the subsections" do
      let(:devicegraph) do
        instance_double(
          Y2Storage::Devicegraph,
          disk_devices:                  disks,
          lvm_vgs:                       [vg],
          software_raids:                [md],
          stray_blk_devices:             [stray],
          bcaches:                       [bcache],
          nfs_mounts:                    [nfs],
          multidevice_btrfs_filesystems: [btrfs],
          tmp_filesystems:               [tmpfs0, tmpfs1]
        )
      end

      let(:disks) { [disk, dasd] }
      let(:disk) { instance_double(Y2Storage::Disk) }
      let(:dasd) { instance_double(Y2Storage::Dasd) }
      let(:vg) { instance_double(Y2Storage::LvmVg) }
      let(:md) { instance_double(Y2Storage::Md) }
      let(:stray) { instance_double(Y2Storage::StrayBlkDevice) }
      let(:bcache) { instance_double(Y2Storage::Bcache) }
      let(:nfs) { instance_double(Y2Storage::Filesystems::Nfs) }
      let(:btrfs) { instance_double(Y2Storage::Filesystems::Btrfs) }
      let(:tmpfs0) { instance_double(Y2Storage::Filesystems::Tmpfs) }
      let(:tmpfs1) { instance_double(Y2Storage::Filesystems::Tmpfs) }

      before do
        allow(Y2Storage::AutoinstProfile::DriveSection).to receive(:new_from_storage)
          .with(disk).and_return(disk_section)
        allow(Y2Storage::AutoinstProfile::DriveSection).to receive(:new_from_storage)
          .with(dasd).and_return(dasd_section)
        allow(Y2Storage::AutoinstProfile::DriveSection).to receive(:new_from_storage)
          .with(vg).and_return(vg_section)
        allow(Y2Storage::AutoinstProfile::DriveSection).to receive(:new_from_storage)
          .with(md).and_return(md_section)
        allow(Y2Storage::AutoinstProfile::DriveSection).to receive(:new_from_storage)
          .with(stray).and_return(stray_section)
        allow(Y2Storage::AutoinstProfile::DriveSection).to receive(:new_from_storage)
          .with(bcache).and_return(bcache_section)
        allow(Y2Storage::AutoinstProfile::DriveSection).to receive(:new_from_storage)
          .with(nfs).and_return(nfs_section)
        allow(Y2Storage::AutoinstProfile::DriveSection).to receive(:new_from_storage)
          .with(btrfs).and_return(btrfs_section)
        allow(Y2Storage::AutoinstProfile::DriveSection).to receive(:new_from_storage)
          .with(tmpfs0).and_return(tmpfs0_section)
        allow(Y2Storage::AutoinstProfile::DriveSection).to receive(:new_from_storage)
          .with(tmpfs1).and_return(tmpfs1_section)
      end

      subject(:section) { described_class.new_from_storage(devicegraph) }

      it "returns a new PartitioningSection object" do
        expect(section).to be_a(described_class)
      end

      it "creates an entry in #drives for every relevant disk" do
        expect(section.drives).to include(disk_section)
      end

      it "creates an entry in #drives for every relevant DASD" do
        expect(section.drives).to include(dasd_section)
      end

      it "creates an entry in #drives for every relevant stray device" do
        expect(section.drives).to include(stray_section)
      end

      it "creates an entry in #drives for every relevant LVM VG" do
        expect(section.drives).to include(vg_section)
      end

      it "creates an entry in #drives for every relevant MD RAID" do
        expect(section.drives).to include(md_section)
      end

      it "creates an entry in #drives for every relevant Bcache" do
        expect(section.drives).to include(bcache_section)
      end

      it "creates an entry in #drives for every relevant NFS" do
        expect(section.drives).to include(nfs_section)
      end

      it "creates an entry in #drives for every relevant Btrfs" do
        expect(section.drives).to include(btrfs_section)
      end

      it "creates a single entry in #drives grouping all tmpfs filesystems" do
        tmpfs = section.drives.select { |d| d.type == :CT_TMPFS }
        expect(tmpfs.size).to eq(1)
        expect(tmpfs.first.partitions.map(&:mount)).to contain_exactly("/srv", "/var/tmp")
      end

      it "ignores irrelevant drives" do
        allow(Y2Storage::AutoinstProfile::DriveSection).to receive(:new_from_storage)
          .with(disk).and_return(nil)

        expect(section.drives).to_not include(disk_section)
      end
    end

    # Regression test for bug#1098594, BIOS RAIDs were exported as
    # software-defined ones
    context "with a BIOS MD RAID in the system" do
      before do
        fake_scenario("bug_1098594.xml")
      end

      it "creates only one CT_DISK entry in #drives, for the BIOS RAID" do
        section = described_class.new_from_storage(fake_devicegraph)
        drive = section.drives.find { |d| d.type == :CT_DISK }

        expect(drive).to_not be_nil
        expect(drive.device).to eq("/dev/md/Volume0_0")
      end
    end

    # Regression test for bug#1209725, thin volumes were not exported
    context "in a scenario that combines normal and thin volumes" do
      before { fake_scenario("bug_1209725.xml") }

      it "includes the thin pool as a partition of the CT_LVM drive" do
        section = described_class.new_from_storage(fake_devicegraph)
        drive = section.drives.find { |d| d.type == :CT_LVM }

        pool = drive.partitions.find(&:pool)
        expect(pool.lv_name).to eq "thin_pool00"
      end

      it "includes all the volumes (normal and thin ones) as partitions in the CT_LVM drive" do
        section = described_class.new_from_storage(fake_devicegraph)
        drive = section.drives.find { |d| d.type == :CT_LVM }

        lvs = drive.partitions.reject(&:pool).map { |d| [d.mount, d.used_pool] }
        expect(lvs).to contain_exactly(
          ["/boot", nil], ["swap", nil],
          ["/home", "thin_pool00"], ["/", "thin_pool00"], ["/var", "thin_pool00"]
        )
      end
    end
  end

  describe "#to_hashes" do
    subject(:section) { described_class.new_from_hashes(partitioning) }

    it "returns an array of hashes" do
      expect(subject.to_hashes).to be_a(Array)
      expect(subject.to_hashes).to all(be_a(Hash))
    end

    it "includes a hash for every drive" do
      hashes = subject.to_hashes
      device_names = hashes.map { |h| h["device"] }
      expect(device_names).to eq(["/dev/sda", "/dev/sdb"])
    end
  end

  describe "filtered drives lists" do
    subject(:section) { described_class.new }
    let(:drive1) { double("DriveSection", device: "/dev/sda", type: :CT_DISK) }
    let(:drive2) { double("DriveSection", device: "/dev/sdb", type: :CT_DISK) }
    let(:drive3) { double("DriveSection", device: "/dev/vg0", type: :CT_LVM) }
    let(:drive4) { double("DriveSection", device: "/dev/vg1", type: :CT_LVM) }
    let(:drive5) { double("DriveSection", device: "/dev/md", type: :CT_MD) }
    let(:drive6) { double("DriveSection", device: "/dev/md", type: :CT_MD) }
    let(:drive7) { double("DriveSection", type: :CT_DISK) }
    let(:drive8) { double("DriveSection", type: :CT_BCACHE) }
    let(:drive9) { double("DriveSection", type: :CT_NFS) }
    let(:drive10) { double("DriveSection", type: :CT_BTRFS) }
    let(:drive11) { double("DriveSection", type: :CT_DMMULTIPATH) }
    let(:drive12) { double("DriveSection", type: :CT_TMPFS) }
    let(:wrongdrv1) { double("DriveSection", device: "/dev/md", type: :CT_DISK) }
    let(:wrongdrv2) { double("DriveSection", device: "/dev/sdc", type: :CT_MD) }
    let(:wrongdrv3) { double("DriveSection", device: "/dev/sdd", type: :CT_WRONG) }
    let(:wrongdrv4) { double("DriveSection", type: :CT_LVM) }
    let(:wrongdrv5) { double("DriveSection", type: :CT_MD) }

    before do
      section.drives = [
        drive1, drive2, drive3, drive4, drive5, drive6, drive7, drive8, drive9, drive10,
        drive11, drive12, wrongdrv1, wrongdrv2, wrongdrv3, wrongdrv4, wrongdrv5
      ]
    end

    describe "#disk_drives" do
      it "returns drives which type is :CT_DISK or :CT_DMMULTIPATH, even if they look invalid" do
        expect(section.disk_drives).to contain_exactly(drive1, drive2, drive7, drive11, wrongdrv1)
      end
    end

    describe "#lvm_drives" do
      it "returns drives which type is :CT_LVM, even if they look invalid" do
        expect(section.lvm_drives).to contain_exactly(drive3, drive4, wrongdrv4)
      end
    end

    describe "#md_drives" do
      it "returns drives which type is :CT_MD, even if they look invalid" do
        expect(section.md_drives).to contain_exactly(drive5, drive6, wrongdrv2, wrongdrv5)
      end

      it "does not include drives of other types with device='/dev/md'" do
        expect(section.md_drives).to_not include wrongdrv1
      end
    end

    describe "#bcache_drives" do
      it "returns drives which type is :CT_BCACHE, even if they look invalid" do
        expect(section.bcache_drives).to contain_exactly(drive8)
      end
    end

    describe "#btrfs_drives" do
      it "returns drives which type is :CT_BTRFS, even if they look invalid" do
        expect(section.btrfs_drives).to contain_exactly(drive10)
      end
    end

    describe "#nfs_drives" do
      it "returns drives which type is :CT_NFS, even if they look invalid" do
        expect(section.nfs_drives).to contain_exactly(drive9)
      end
    end

    describe "#tmpfs_drives" do
      it "returns drives which type is :CT_TMPFS" do
        expect(section.tmpfs_drives).to contain_exactly(drive12)
      end
    end
  end

  describe "#section_name" do
    it "returns 'partitioning'" do
      expect(section.section_name).to eq("partitioning")
    end
  end

  describe "#parent" do
    it "returns nil" do
      expect(section.parent).to be_nil
    end
  end
end
