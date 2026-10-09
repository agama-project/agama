#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2016-2019] SUSE LLC
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

RSpec.shared_examples "planned root or disk in devicegraph" do
  context "and '/' is planned" do
    let(:planned_devs) { [planned_root] }

    context "and the disk to allocate the planned '/' is known" do
      before do
        planned_root.disk = planned_root_disk
      end

      context "and such disk exists" do
        let(:planned_root_disk) { "/dev/sda" }

        it "returns a Disk object" do
          expect(analyzer.boot_disk).to be_a(Y2Storage::Disk)
        end

        it "returns the disk where root is planned" do
          expect(analyzer.boot_disk.name).to eq(planned_root.disk)
        end
      end

      context "and such disk does not exist" do
        let(:planned_root_disk) { "/dev/sdx" }

        include_examples "boot disk in devicegraph"
      end
    end

    context "and the disk to allocate the planned '/' is not known" do
      include_examples "boot disk in devicegraph"
    end
  end

  context "and '/' is not planned" do
    let(:planned_devs) { [] }

    include_examples "boot disk in devicegraph"
  end
end

RSpec.shared_examples "boot disk in devicegraph" do
  before do
    filesystem.mount_path = mount_point
  end

  context "if there is a filesystem configured as '/boot'" do
    let(:mount_point) { "/boot" }

    include_examples "filesystem in devicegraph"
  end

  context "if there is no filesystem configured as '/boot'" do
    context "and there is a filesystem configured as '/'" do
      let(:mount_point) { "/" }

      include_examples "filesystem in devicegraph"
    end

    context "and there is no filesystem configured as '/'" do
      let(:scenario) { "multi-linux-pc" }

      let(:filesystem) { fake_devicegraph.find_by_name("/dev/sda1").filesystem }

      let(:mount_point) { "" }

      it "returns a Disk object" do
        expect(analyzer.boot_disk).to be_a Y2Storage::Disk
      end

      it "returns the first disk in the system" do
        expect(analyzer.boot_disk.name).to eq "/dev/sda"
      end
    end
  end
end

RSpec.shared_examples "filesystem in devicegraph" do
  def create_filesystem
    part = device.partition_table.create_partition("#{device.name}-1",
      Y2Storage::Region.create(2048, 1048576, 512),
      Y2Storage::PartitionType::PRIMARY)
    part.create_filesystem(Y2Storage::Filesystems::Type::EXT4)
  end

  let(:device) { fake_devicegraph.find_by_name(device_name) }

  let(:filesystem) { device.filesystem }

  context "and the filesystem is over a partition in a disk" do
    let(:scenario) { "double-windows-pc" }

    let(:device_name) { "/dev/sdb1" }

    it "returns a Disk object" do
      expect(analyzer.boot_disk).to be_a Y2Storage::Disk
    end

    it "returns the disk containing the partition" do
      expect(analyzer.boot_disk.name).to eq("/dev/sdb")
    end
  end

  context "and the filesystem is over a partition in a DASD device" do
    let(:scenario) { "dasd_50GiB" }

    let(:device_name) { "/dev/dasda1" }

    it "returns a Dasd object" do
      expect(analyzer.boot_disk).to be_a Y2Storage::Dasd
    end

    it "returns the dasd device containing the partition" do
      expect(analyzer.boot_disk.name).to eq "/dev/dasda"
    end
  end

  context "and the filesystem is over a partition in a Multipath device" do
    let(:scenario) { "empty-dasd-and-multipath.xml" }

    let(:device_name) { "/dev/mapper/36005076305ffc73a00000000000013b4" }

    let(:filesystem) { create_filesystem }

    it "returns a Multipath object" do
      expect(analyzer.boot_disk).to be_a Y2Storage::Multipath
    end

    it "returns the Multipath device containing the partition" do
      expect(analyzer.boot_disk.name).to eq device_name
    end
  end

  context "and the filesystem is over a partition in a BIOS RAID" do
    let(:scenario) { "empty-dm_raids.xml" }

    let(:device_name) { "/dev/mapper/isw_ddgdcbibhd_test1" }

    let(:filesystem) { create_filesystem }

    it "returns a BIOS RAID" do
      expect(analyzer.boot_disk.is?(:bios_raid)).to eq(true)
    end

    it "returns the BIOS RAID containing the partition" do
      expect(analyzer.boot_disk.name).to eq device_name
    end
  end

  context "and the filesystem is over a partition in a LVM LV" do
    let(:scenario) { "lvm-two-vgs" }

    let(:device_name) { "/dev/vg0/lv2" }

    it "returns a Disk object" do
      expect(analyzer.boot_disk).to be_a Y2Storage::Disk
    end

    it "returns the first disk containing a PV of the involved LVM VG" do
      expect(analyzer.boot_disk.name).to eq "/dev/sda"
    end
  end

  # Regression bsc#1129787
  context "and the filesystem is over a Bcache" do
    let(:scenario) { "bcache-root-ext4.xml" }

    let(:device_name) { "/dev/bcache0" }

    it "returns a Disk object" do
      expect(analyzer.boot_disk).to be_a Y2Storage::Disk
    end

    it "returns the disk containing the backing device of the Bcache" do
      expect(analyzer.boot_disk.name).to eq "/dev/sda"
    end
  end

  # Regression bsc#1129787
  context "and the filesystem is over a Flash-only Bcache" do
    let(:scenario) { "bcache2.xml" }

    let(:device_name) { "/dev/bcache2" }

    it "returns a Disk object" do
      expect(analyzer.boot_disk).to be_a Y2Storage::Disk
    end

    it "returns the first disk used as caching device" do
      expect(analyzer.boot_disk.name).to eq "/dev/sdb"
    end
  end
end

describe Y2Storage::BootRequirementsStrategies::Analyzer do
  include_context "yast2-storage-ng test setup"

  let(:scenario) { "mixed_disks" }
  let(:devicegraph) { fake_devicegraph }
  let(:boot_name) { "" }
  let(:planned_root) { planned_partition(mount_point: "/") }
  let(:planned_boot) { planned_partition(mount_point: "/boot") }
  let(:planned_devs) { [planned_boot, planned_root] }

  before do
    # Needed for the s390_luks2 scenario
    allow(Yast::Execute).to receive(:locally).with(/zkey/, any_args)

    fake_scenario(scenario)
  end

  describe ".new" do
    # There was such a bug, test added to avoid regression"
    it "does not modify the passed collections" do
      initial_graph = devicegraph.dup
      described_class.new(devicegraph, planned_devs, boot_name)

      expect(planned_devs.map(&:mount_point)).to eq ["/boot", "/"]
      expect(devicegraph.actiongraph(from: initial_graph)).to be_empty
    end

    context "when there is a root" do
      let(:scenario) { "mixed_disks" }

      it "stores the root filesystem" do
        analyzer = described_class.new(devicegraph, planned_devs, boot_name)
        expect(analyzer.root_filesystem).to be_a(Y2Storage::Filesystems::Base)
        expect(analyzer.root_filesystem.mount_path).to eq("/")
      end
    end

    context "when there is no root" do
      let(:scenario) { "empty_hard_disk_50GiB" }

      it "does not store a filesystem" do
        analyzer = described_class.new(devicegraph, planned_devs, boot_name)
        expect(analyzer.root_filesystem).to be_nil
      end
    end
  end

  describe "#boot_disk" do
    subject(:analyzer) { described_class.new(devicegraph, planned_devs, boot_name) }

    context "if the name of the boot disk is known and the disk exists" do
      let(:boot_name) { "/dev/sdb" }

      it "returns a Disk object" do
        expect(analyzer.boot_disk).to be_a Y2Storage::Disk
      end

      it "returns the disk matching the given name" do
        expect(analyzer.boot_disk.name).to eq boot_name
      end
    end

    context "if no name is given or there is no such disk" do
      let(:boot_name) { nil }

      context "and '/boot' is planned" do
        let(:planned_devs) { [planned_boot] }

        context "and the disk to allocate the planned '/boot' is known" do
          before do
            planned_boot.disk = planned_boot_disk
          end

          context "and such disk exists" do
            let(:planned_boot_disk) { "/dev/sdb" }

            it "returns a Disk object" do
              expect(analyzer.boot_disk).to be_a(Y2Storage::Disk)
            end

            it "returns the disk where boot is planned" do
              expect(analyzer.boot_disk.name).to eq(planned_boot.disk)
            end
          end

          context "and such disk does not exist" do
            let(:planned_boot_disk) { "/dev/sdx" }

            include_examples "planned root or disk in devicegraph"
          end
        end

        context "and the disk to allocate the planned '/boot' is not known" do
          include_examples "planned root or disk in devicegraph"
        end
      end

      context "and '/boot' is not planned" do
        let(:planned_devs) { [] }

        include_examples "planned root or disk in devicegraph"
      end
    end
  end

  describe "#root_in_lvm?" do
    subject(:analyzer) { described_class.new(devicegraph, planned_devs, boot_name) }

    context "if '/' is a planned logical volume" do
      let(:planned_root) { planned_lv(mount_point: "/") }

      it "returns true" do
        expect(analyzer.root_in_lvm?).to eq true
      end
    end

    context "if '/' is a planned partition" do
      let(:planned_root) { planned_partition(mount_point: "/") }

      it "returns false" do
        expect(analyzer.root_in_lvm?).to eq false
      end
    end

    context "if '/' is a logical volume from the devicegraph" do
      let(:planned_devs) { [] }
      let(:scenario) { "complex-lvm-encrypt" }

      it "returns true" do
        expect(analyzer.root_in_lvm?).to eq true
      end
    end

    context "if '/' is a partition from the devicegraph" do
      let(:planned_devs) { [] }
      let(:scenario) { "mixed_disks" }

      it "returns false" do
        expect(analyzer.root_in_lvm?).to eq false
      end
    end

    context "if no device or planned device is configured as '/'" do
      let(:planned_devs) { [] }
      let(:scenario) { "double-windows-pc" }

      it "returns false" do
        expect(analyzer.root_in_lvm?).to eq false
      end
    end
  end

  describe "#root_in_software_raid?" do
    subject(:analyzer) { described_class.new(devicegraph, planned_devs, boot_name) }

    context "if '/' is a planned software raid" do
      let(:planned_root) { planned_md(mount_point: "/") }

      it "returns true" do
        expect(analyzer.root_in_software_raid?).to eq true
      end
    end

    context "if '/' is a planned partition" do
      let(:planned_root) { planned_partition(mount_point: "/") }

      it "returns false" do
        expect(analyzer.root_in_software_raid?).to eq false
      end
    end

    context "if '/' is a planned logical volume" do
      let(:planned_root) { planned_lv(mount_point: "/") }

      it "returns false" do
        expect(analyzer.root_in_software_raid?).to eq false
      end
    end

    context "if '/' is a software raid from the devicegraph" do
      let(:planned_devs) { [] }
      let(:scenario) { "nested_md_raids" }

      before do
        md = Y2Storage::Md.find_by_name(fake_devicegraph, "/dev/md0")
        md.remove_descendants
        fs = md.create_filesystem(Y2Storage::Filesystems::Type::EXT4)
        fs.mount_path = "/"
      end

      it "returns true" do
        expect(analyzer.root_in_software_raid?).to eq true
      end
    end

    context "if '/' is a partition over a software raid from the devicegraph" do
      let(:planned_devs) { [] }
      let(:scenario) { "nested_md_raids" }

      before do
        md = Y2Storage::Md.find_by_name(fake_devicegraph, "/dev/md0")
        part = md.partition_table.create_partition("/dev/md0-1",
          Y2Storage::Region.create(2048, 1048576, 512),
          Y2Storage::PartitionType::PRIMARY)
        fs = part.create_filesystem(Y2Storage::Filesystems::Type::EXT4)
        fs.mount_path = "/"
      end

      it "returns true" do
        expect(analyzer.root_in_software_raid?).to eq true
      end
    end

    context "if '/' is a partition over a disk from the devicegraph" do
      let(:planned_devs) { [] }
      let(:scenario) { "mixed_disks" }

      it "returns false" do
        expect(analyzer.root_in_software_raid?).to eq false
      end
    end

    context "if '/' is a logical volume from the devicegraph" do
      let(:planned_devs) { [] }
      let(:scenario) { "complex-lvm-encrypt" }

      it "returns false" do
        expect(analyzer.root_in_software_raid?).to eq false
      end
    end

    context "if no device or planned device is configured as '/'" do
      let(:planned_devs) { [] }
      let(:scenario) { "double-windows-pc" }

      it "returns false" do
        expect(analyzer.root_in_software_raid?).to eq false
      end
    end
  end

  describe "#encrypted_root?" do
    subject(:analyzer) { described_class.new(devicegraph, planned_devs, boot_name) }

    context "if '/' is a planned plain logical volume" do
      let(:planned_root) { planned_lv(mount_point: "/") }

      it "returns false" do
        expect(analyzer.encrypted_root?).to eq false
      end
    end

    context "if '/' is a planned encrypted logical volume" do
      let(:planned_root) { planned_lv(mount_point: "/", encryption_password: "12345678") }

      it "returns true" do
        expect(analyzer.encrypted_root?).to eq true
      end
    end

    context "if '/' is a planned plain partition" do
      let(:planned_root) { planned_partition(mount_point: "/") }

      it "returns false" do
        expect(analyzer.encrypted_root?).to eq false
      end
    end

    context "if '/' is a planned encrypted partition" do
      let(:planned_root) { planned_partition(mount_point: "/", encryption_password: "12345678") }

      it "returns true" do
        expect(analyzer.encrypted_root?).to eq true
      end
    end

    context "if '/' is a plain partition from the devicegraph" do
      let(:planned_devs) { [] }
      let(:scenario) { "mixed_disks" }

      it "returns false" do
        expect(analyzer.encrypted_root?).to eq false
      end
    end

    context "if '/' is an encrypted partition from the devicegraph" do
      let(:planned_devs) { [] }
      let(:scenario) { "output/empty_hard_disk_gpt_50GiB-enc" }

      it "returns true" do
        expect(analyzer.encrypted_root?).to eq true
      end
    end

    context "if no device or planned device is configured as '/'" do
      let(:planned_devs) { [] }
      let(:scenario) { "double-windows-pc" }

      it "returns false" do
        expect(analyzer.encrypted_root?).to eq false
      end
    end
  end

  describe "#encrypted_zipl?" do
    subject(:analyzer) { described_class.new(devicegraph, planned_devs, boot_name) }
    let(:planned_devs) { [planned_zipl] }

    context "if '/boot/zipl' is a planned plain partition" do
      let(:planned_zipl) { planned_partition(mount_point: "/boot/zipl") }

      it "returns false" do
        expect(analyzer.encrypted_zipl?).to eq false
      end
    end

    context "if '/boot/zipl' is a planned encrypted partition" do
      let(:planned_zipl) do
        planned_partition(mount_point: "/boot/zipl", encryption_password: "12345678")
      end

      it "returns true" do
        expect(analyzer.encrypted_zipl?).to eq true
      end
    end

    context "if '/boot/zipl' is a plain partition from the devicegraph" do
      let(:planned_devs) { [] }
      let(:scenario) { "output/s390_dasd_zipl" }

      it "returns false" do
        expect(analyzer.encrypted_zipl?).to eq false
      end
    end

    context "if '/boot/zipl' is an encrypted partition from the devicegraph" do
      let(:planned_devs) { [] }
      let(:scenario) { "s390_luks2" }

      it "returns true" do
        expect(analyzer.encrypted_zipl?).to eq true
      end
    end

    context "if no device or planned device is configured as '/boot/zipl'" do
      let(:planned_devs) { [] }
      let(:scenario) { "several-dasds" }

      it "returns false" do
        expect(analyzer.encrypted_zipl?).to eq false
      end
    end
  end

  describe "#btrfs_root?" do
    subject(:analyzer) { described_class.new(devicegraph, planned_devs, boot_name) }
    let(:ext4) { Y2Storage::Filesystems::Type::EXT4 }
    let(:btrfs) { Y2Storage::Filesystems::Type::BTRFS }

    context "if '/' is a non-btrfs planned logical volume" do
      let(:planned_root) { planned_lv(mount_point: "/", type: ext4) }

      it "returns false" do
        expect(analyzer.btrfs_root?).to eq false
      end
    end

    context "if '/' is a btrfs planned logical volume" do
      let(:planned_root) { planned_lv(mount_point: "/", type: btrfs) }

      it "returns true" do
        expect(analyzer.btrfs_root?).to eq true
      end
    end

    context "if '/' is a non-btrfs plain partition" do
      let(:planned_root) { planned_partition(mount_point: "/", type: ext4) }

      it "returns false" do
        expect(analyzer.btrfs_root?).to eq false
      end
    end

    context "if '/' is a planned encrypted partition" do
      let(:planned_root) { planned_partition(mount_point: "/", type: btrfs) }

      it "returns true" do
        expect(analyzer.btrfs_root?).to eq true
      end
    end

    context "if '/' is a non-btrfs device from the devicegraph" do
      let(:planned_devs) { [] }
      let(:scenario) { "complex-lvm-encrypt" }

      it "returns false" do
        expect(analyzer.btrfs_root?).to eq false
      end
    end

    context "if '/' is an encrypted device from the devicegraph" do
      let(:planned_devs) { [] }
      let(:scenario) { "mixed_disks" }

      it "returns true" do
        expect(analyzer.btrfs_root?).to eq true
      end
    end

    context "if no device or planned device is configured as '/'" do
      let(:planned_devs) { [] }
      let(:scenario) { "double-windows-pc" }

      it "returns false" do
        expect(analyzer.btrfs_root?).to eq false
      end
    end
  end

  describe "#boot_ptable_type?" do
    subject(:analyzer) { described_class.new(devicegraph, planned_devs, boot_name) }
    let(:scenario) { "gpt_msdos_and_empty" }

    before do
      allow(analyzer).to receive(:boot_disk) do
        Y2Storage::Disk.find_by_name(fake_devicegraph, disk_name)
      end
    end

    context "if there are no disks" do
      before { allow(analyzer).to receive(:boot_disk).and_return nil }

      it "returns false all the partition types" do
        expect(analyzer.boot_ptable_type?(:gpt)).to eq false
        expect(analyzer.boot_ptable_type?(:msdos)).to eq false
        expect(analyzer.boot_ptable_type?(:dasd)).to eq false
      end
    end

    context "if the boot disk contains no partition table" do
      let(:disk_name) { "/dev/sde" }

      it "returns false for GPT (the default proposal type)" do
        expect(analyzer.boot_ptable_type?(:gpt)).to eq false
      end

      it "returns false for any other type" do
        expect(analyzer.boot_ptable_type?(:msdos)).to eq false
        expect(analyzer.boot_ptable_type?(:dasd)).to eq false
      end

      it "returns true for nil" do
        expect(analyzer.boot_ptable_type?(nil)).to eq true
      end
    end

    context "if the boot disk contains a GPT partition table" do
      let(:disk_name) { "/dev/sdc" }

      it "returns true for GPT" do
        expect(analyzer.boot_ptable_type?(:gpt)).to eq true
      end

      it "returns false for any other type" do
        expect(analyzer.boot_ptable_type?(:msdos)).to eq false
        expect(analyzer.boot_ptable_type?(:dasd)).to eq false
      end
    end

    context "if the boot disk contains a MSDOS partition table" do
      let(:disk_name) { "/dev/sda" }

      it "returns true for MSDOS" do
        expect(analyzer.boot_ptable_type?(:msdos)).to eq true
      end

      it "returns false for any other type" do
        expect(analyzer.boot_ptable_type?(:gpt)).to eq false
        expect(analyzer.boot_ptable_type?(:dasd)).to eq false
      end
    end
  end

  describe "#free_mountpoint?" do
    subject(:analyzer) { described_class.new(devicegraph, planned_devs, boot_name) }
    let(:point) { "/home" }

    context "if there is a planned device for the queried mount point" do
      let(:planned_devs) { [planned_partition(mount_point: "/some-dir")] }
      let(:point) { "/some-dir" }

      it "returns false" do
        expect(analyzer.free_mountpoint?(point)).to eq false
      end
    end

    context "if there is no planned device for the mount point" do
      context "but the queried mount point is already assigned in the devicegraph" do
        let(:scenario) { "mixed_disks" }
        let(:planned_devs) { [planned_partition(mount_point: "/home")] }

        it "returns false" do
          expect(analyzer.free_mountpoint?(point)).to eq false
        end
      end

      context "and the mount point is not used in the devicegraph either" do
        let(:scenario) { "double-windows-pc" }

        it "returns true" do
          expect(analyzer.free_mountpoint?(point)).to eq true
        end
      end
    end
  end

  describe "#planned_prep_partitions" do
    subject(:analyzer) { described_class.new(devicegraph, planned_devs, boot_name) }
    let(:planned_prep) { planned_partition(partition_id: Y2Storage::PartitionId::PREP) }
    let(:planned_devs) do
      [planned_lv, planned_prep, planned_partition(partition_id: Y2Storage::PartitionId::LVM)]
    end

    it "returns a list of the planned partitions with the PReP id" do
      expect(analyzer.planned_prep_partitions).to eq [planned_prep]
    end
  end

  describe "#planned_grub_partitions" do
    subject(:analyzer) { described_class.new(devicegraph, planned_devs, boot_name) }
    let(:planned_grub) { planned_partition(partition_id: Y2Storage::PartitionId::BIOS_BOOT) }
    let(:planned_devs) do
      [planned_lv, planned_partition(partition_id: Y2Storage::PartitionId::PREP), planned_grub]
    end

    it "returns a list of the planned partitions with the BIOS boot id" do
      expect(analyzer.planned_grub_partitions).to eq [planned_grub]
    end
  end

  describe "#boot_in_thin_lvm?" do
    subject(:analyzer) { described_class.new(devicegraph, planned_devs, boot_name) }
    let(:planned_devs) { [] }

    def create_filesystem(device_name, mount_point)
      device = fake_devicegraph.find_by_name(device_name)
      fs = device.create_filesystem(Y2Storage::Filesystems::Type::EXT4)
      fs.create_mount_point(mount_point)
      fs
    end

    context "If the filesystem is in a thinly provisioned LVM" do
      let(:scenario) { "thin1-probed.xml" }

      context "without a separate /boot and / on a thin LVM" do
        before do
          create_filesystem("/dev/test/thin1", "/")
        end

        it "returns true" do
          expect(analyzer.boot_in_thin_lvm?).to eq true
        end
      end

      context "with a separate /boot also on a thin LVM" do
        before do
          create_filesystem("/dev/test/thin1", "/")
          create_filesystem("/dev/test/thin2", "/boot")
        end

        it "returns true" do
          expect(analyzer.boot_in_thin_lvm?).to eq true
        end
      end
    end

    context "If the filesystem is in a normal (non-thin) LVM" do
      let(:scenario) { "lvm-two-vgs" }
      let(:device_name) { "/dev/vg0/lv2" }

      it "returns false" do
        expect(analyzer.boot_in_thin_lvm?).to eq false
      end
    end
  end

  describe "#boot_in_bcache?" do
    subject(:analyzer) { described_class.new(devicegraph, planned_devs, boot_name) }

    let(:planned_devs) { [] }
    let(:scenario) { "partitioned_btrfs_bcache.xml" }
    let(:bcache_device_name) { "/dev/bcache0" }
    let(:bcache_device) { fake_devicegraph.find_by_name(bcache_device_name) }
    let(:boot_partition) { fake_devicegraph.find_by_name("/dev/vda2") }

    context "when /boot mounted in neither, bcache device nor bcache partition" do
      it "returns false" do
        expect(analyzer.boot_in_bcache?).to eq false
      end
    end

    context "when /boot mounted in a bcache device" do
      before do
        # Reassign the mount point from /dev/vda (Ext4 partition) to /dev/bcache0
        boot_partition.filesystem.mount_path = ""
        bcache_device.remove_descendants
        bcache_device.create_blk_filesystem(Y2Storage::Filesystems::Type::EXT4)
        bcache_device.filesystem.mount_path = "/boot"
      end

      it "returns true" do
        expect(analyzer.boot_in_bcache?).to eq true
      end
    end

    # Regression test for bsc#1165903: recognizes that /boot is in a bcache
    # when placed explicitly or implicitly in a bcache partition.
    context "when /boot mounted in a bcache partition" do
      it "returns true" do
        # Remove the /boot mount point, which means
        # it will be on the root filesystem, i.e., /dev/bcache0p1
        boot_partition.filesystem.mount_path = ""

        expect(analyzer.boot_in_bcache?).to eq true
      end
    end
  end

  describe "#boot_encryption_type" do
    subject(:analyzer) { described_class.new(devicegraph, planned_devs, boot_name) }

    context "if '/boot' is a planned plain partition" do
      let(:planned_boot) { planned_partition(mount_point: "/boot") }

      it "returns type none" do
        expect(analyzer.boot_encryption_type).to eq Y2Storage::EncryptionType::NONE
      end
    end

    context "if '/boot' is a planned partition to be encrypted with LUKS1" do
      let(:planned_boot) { planned_partition(mount_point: "/boot", encryption_password: "12345678") }

      it "returns type luks1" do
        expect(analyzer.boot_encryption_type).to eq Y2Storage::EncryptionType::LUKS1
      end
    end

    context "if '/boot' is a planned encrypted logical volume" do
      let(:planned_boot) { planned_lv(mount_point: "/boot", encryption_password: "12345678") }

      it "returns type luks1" do
        expect(analyzer.boot_encryption_type).to eq Y2Storage::EncryptionType::LUKS1
      end
    end

    context "if '/boot' is a planned partition to be encrypted with pervasive encryption" do
      let(:planned_boot) do
        planned_partition(
          mount_point: "/boot", encryption_method: Y2Storage::EncryptionMethod::PERVASIVE_LUKS2
        )
      end

      it "returns type luks1" do
        expect(analyzer.boot_encryption_type).to eq Y2Storage::EncryptionType::LUKS2
      end
    end

    context "if '/boot' is a plain partition from the devicegraph" do
      let(:planned_devs) { [] }
      let(:scenario) { "mixed_disks" }

      it "returns type none" do
        expect(analyzer.boot_encryption_type).to eq Y2Storage::EncryptionType::NONE
      end
    end

    context "if '/boot' is an encrypted partition from the devicegraph with default encryption" do
      let(:planned_devs) { [] }
      let(:scenario) { "output/empty_hard_disk_gpt_50GiB-enc" }

      it "returns type luks1" do
        expect(analyzer.boot_encryption_type).to eq Y2Storage::EncryptionType::LUKS1
      end
    end

    context "if '/boot' is an encrypted partition with encryption type luks2" do
      let(:planned_devs) { [] }
      let(:scenario) { "output/empty_hard_disk_gpt_50GiB-enc" }
      before do
        fake_devicegraph.find_by_name("/dev/sda2").encryption.type = Y2Storage::EncryptionType::LUKS2
      end

      it "returns type luks2" do
        expect(analyzer.boot_encryption_type).to eq Y2Storage::EncryptionType::LUKS2
      end
    end
  end
end
