#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2021] SUSE LLC
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
require_relative "../support/shared_setup"

require "y2storage"

describe Y2Storage::BlkDevice do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  before do
    fake_scenario(scenario)
  end

  subject(:device) { Y2Storage::BlkDevice.find_by_name(fake_devicegraph, device_name) }

  let(:scenario) { "complex-lvm-encrypt" }

  describe "#formatted?" do
    let(:device_name) { "/dev/sda" }

    context "when the device is not formatted" do
      it "returns false" do
        expect(device.formatted?).to eq(false)
      end
    end

    context "when the device is formatted" do
      before do
        device.remove_descendants
        device.create_filesystem(Y2Storage::Filesystems::Type::EXT3)
      end

      it "returns true" do
        expect(device.formatted?).to eq(true)
      end
    end
  end

  describe "#formatted_as?" do
    let(:device_name) { "/dev/sda" }

    context "when the device is not formatted" do
      it "returns false" do
        expect(device.formatted_as?(:swap)).to eq(false)
      end
    end

    context "when the device is formatted" do
      before do
        device.remove_descendants
        device.create_filesystem(Y2Storage::Filesystems::Type::EXT3)
      end

      context "and it is formatted in a given filesystem type" do
        let(:fs_types) { [:ext2, :ext3, :ext4] }

        it "returns true" do
          expect(device.formatted_as?(*fs_types)).to eq(true)
        end
      end

      context "and it is not formatted in a given filesystem type" do
        let(:fs_types) { [:ext4, :btrfs] }

        it "returns false" do
          expect(device.formatted_as?(*fs_types)).to eq(false)
        end
      end
    end
  end

  describe "#journal?" do
    context "when the device has not a filesystem" do
      let(:scenario) { "empty_hard_disk_50GiB" }
      let(:device_name) { "/dev/sda" }

      it "returns false" do
        expect(device.journal?).to eq(false)
      end
    end

    context "when the device has a filesystem" do
      let(:scenario) { "bug_1145841.xml" }

      context "and it holds a journal" do
        let(:device_name) { "/dev/sdd1" }

        it "returns true" do
          expect(device.journal?).to eq(true)
        end
      end

      context "but it does not hold a journal" do
        let(:device_name) { "/dev/sda" }

        it "returns false" do
          expect(device.journal?).to eq(false)
        end
      end
    end
  end

  describe "#delete_filesystem" do
    let(:scenario) { "md-imsm1-devicegraph.xml" }

    context "when the device is formatted" do
      let(:device_name) { "/dev/md/a" }

      it "removes the filesystem" do
        expect(device.filesystem).to_not be_nil
        device.delete_filesystem
        expect(device.filesystem).to be_nil
      end
    end

    context "when the device is not formatted" do
      let(:device_name) { "/dev/md/b" }

      it "does not modify the device" do
        children_before = device.children
        device.delete_filesystem
        expect(device.children).to eq(children_before)
      end
    end
  end

  describe "#mount_point" do
    let(:scenario) { "mixed_disks" }

    context "when the device is not formatted" do
      let(:device_name) { "/dev/sdb7" }

      it "returns nil" do
        expect(device.mount_point).to be_nil
      end
    end

    context "when the device is formatted" do
      context "and the filesystem does not have mount point" do
        let(:device_name) { "/dev/sda2" }

        it "returns nil" do
          expect(device.mount_point).to be_nil
        end
      end

      context "and the filesystem has mount point" do
        let(:device_name) { "/dev/sdb2" }

        it "returns the fielesystem mount point" do
          expect(device.mount_point).to be_a(Y2Storage::MountPoint)
          expect(device.mount_point.path).to eq("/")
        end
      end
    end
  end

  describe "#plain_device" do
    context "for a non encrypted device" do
      let(:device_name) { "/dev/sda2" }

      it "returns the device itself" do
        expect(device.plain_device).to eq device
      end
    end

    context "for an encrypted device" do
      let(:device_name) { "/dev/sda4" }

      it "returns the device itself" do
        expect(device.plain_device).to eq device
      end
    end

    context "for an encryption device" do
      let(:device_name) { "/dev/mapper/cr_sda4" }

      it "returns the encrypted device" do
        expect(device.plain_device).to_not eq device
        expect(device.plain_device.name).to eq "/dev/sda4"
      end
    end
  end

  describe "#lvm_pv" do
    context "for a device directly used as PV" do
      let(:device_name) { "/dev/sde2" }

      it "returns the LvmPv device" do
        expect(device.lvm_pv).to be_a Y2Storage::LvmPv
        expect(device.lvm_pv.blk_device).to eq device
      end
    end

    context "for a device used as encrypted PV" do
      let(:device_name) { "/dev/sde1" }

      it "returns the LvmPv device" do
        expect(device.lvm_pv).to be_a Y2Storage::LvmPv
        expect(device.lvm_pv.blk_device.is?(:encryption)).to eq true
        expect(device.lvm_pv.blk_device.plain_device).to eq device
      end
    end

    context "for a device that is not part of LVM" do
      let(:device_name) { "/dev/sda1" }

      it "returns nil" do
        expect(device.lvm_pv).to be_nil
      end
    end

    # Regression test for bsc#1170216: this used to crash because LvmPv#blk_device
    # is never expected to return nil.
    context "if the PV is associated to this and to other block devices (multipath not activated)" do
      let(:scenario) { "inactive_multipath.xml" }
      let(:device_name) { "/dev/sda" }

      # Returning nil may not be precise, but it matches the current libstorage-ng behavior
      # ...and it's better than a crash
      it "returns nil" do
        expect(device.lvm_pv).to be_nil
      end
    end
  end

  describe "#direct_lvm_pv" do
    context "for a device directly used as PV" do
      let(:device_name) { "/dev/sde2" }

      it "returns the LvmPv device" do
        expect(device.direct_lvm_pv).to be_a Y2Storage::LvmPv
        expect(device.direct_lvm_pv.blk_device).to eq device
      end
    end

    context "for a device used as encrypted PV" do
      let(:device_name) { "/dev/sde1" }

      it "returns nil" do
        expect(device.direct_lvm_pv).to be_nil
      end
    end

    context "for a device that is not part of LVM" do
      let(:device_name) { "/dev/sda1" }

      it "returns nil" do
        expect(device.direct_lvm_pv).to be_nil
      end
    end
  end

  describe "#to_be_formatted?" do
    let(:new_devicegraph) { Y2Storage::StorageManager.instance.staging }
    let(:new_device) { Y2Storage::BlkDevice.find_by_name(new_devicegraph, device_name) }

    context "for the original device (same devicegraph)" do
      let(:device_name) { "/dev/sda1" }
      subject(:new_device) { device }

      it "returns false" do
        expect(new_device.to_be_formatted?(fake_devicegraph)).to eq false
      end
    end

    context "if the device is empty (not encrypted or used)" do
      context "if it didn't exist in the original devicegraph" do
        before do
          vg1 = Y2Storage::LvmVg.find_by_vg_name(new_devicegraph, "vg1")
          vg1.create_lvm_lv("newlv", 1.GiB)
        end

        let(:device_name) { "/dev/vg1/newlv" }

        it "returns false" do
          expect(new_device.to_be_formatted?(fake_devicegraph)).to eq false
        end
      end

      context "if it was empty in the original devicegraph" do
        let(:device_name) { "/dev/sdb" }

        it "returns false" do
          expect(new_device.to_be_formatted?(fake_devicegraph)).to eq false
        end
      end

      context "if it was not empty in the original devicegraph" do
        let(:device_name) { "/dev/sda1" }
        before { new_device.remove_descendants }

        it "returns false" do
          expect(new_device.to_be_formatted?(fake_devicegraph)).to eq false
        end
      end
    end

    context "if the device directly contains a filesystem" do
      context "if it didn't exist in the original devicegraph" do
        let(:device_name) { "/dev/vg1/newlv" }

        before do
          vg1 = Y2Storage::LvmVg.find_by_vg_name(new_devicegraph, "vg1")
          vg1.create_lvm_lv("newlv", 1.GiB)
          new_device.create_blk_filesystem(Y2Storage::Filesystems::Type::EXT4)
        end

        it "returns true" do
          expect(new_device.to_be_formatted?(fake_devicegraph)).to eq true
        end
      end

      context "if it contained a different filesystem in the original devicegraph" do
        let(:device_name) { "/dev/sda1" }
        before do
          new_device.remove_descendants
          new_device.create_blk_filesystem(Y2Storage::Filesystems::Type::EXT4)
        end

        it "returns true" do
          expect(new_device.to_be_formatted?(fake_devicegraph)).to eq true
        end
      end

      context "if it contained no filesystem in the original devicegraph" do
        let(:device_name) { "/dev/sdb" }
        before { new_device.create_blk_filesystem(Y2Storage::Filesystems::Type::EXT4) }

        it "returns true" do
          expect(new_device.to_be_formatted?(fake_devicegraph)).to eq true
        end
      end

      context "if it already contained that filesystem in the original devicegraph" do
        let(:device_name) { "/dev/sda1" }

        it "returns false" do
          expect(new_device.to_be_formatted?(fake_devicegraph)).to eq false
        end
      end
    end

    context "if the device contains an encrypted filesystem" do
      context "if it didn't exist in the original devicegraph" do
        let(:device_name) { "/dev/vg1/newlv" }

        before do
          vg1 = Y2Storage::LvmVg.find_by_vg_name(new_devicegraph, "vg1")
          vg1.create_lvm_lv("newlv", 1.GiB)
          new_enc = new_device.create_encryption("newenc")
          new_enc.create_blk_filesystem(Y2Storage::Filesystems::Type::EXT4)
        end

        it "returns true" do
          expect(new_device.to_be_formatted?(fake_devicegraph)).to eq true
        end
      end

      context "if it contained a different filesystem in the original devicegraph" do
        let(:device_name) { "/dev/sda4" }
        before do
          new_device.encryption.remove_descendants
          new_device.encryption.create_blk_filesystem(Y2Storage::Filesystems::Type::EXT4)
        end

        it "returns true" do
          expect(new_device.to_be_formatted?(fake_devicegraph)).to eq true
        end
      end

      context "if it contained no filesystem in the original devicegraph" do
        let(:device_name) { "/dev/sdb" }
        before do
          new_enc = new_device.create_encryption("newenc")
          new_enc.create_blk_filesystem(Y2Storage::Filesystems::Type::EXT4)
        end

        it "returns true" do
          expect(new_device.to_be_formatted?(fake_devicegraph)).to eq true
        end
      end

      context "if it already contained that filesystem in the original devicegraph" do
        let(:device_name) { "/dev/sda4" }

        it "returns false" do
          expect(new_device.to_be_formatted?(fake_devicegraph)).to eq false
        end
      end
    end

    context "if the device is used for other purpose (e.g. LVM PV)" do
      let(:vg1) { Y2Storage::LvmVg.find_by_vg_name(new_devicegraph, "vg1") }

      context "if it was empty in the original devicegraph" do
        let(:device_name) { "/dev/sdb" }

        before { vg1.add_lvm_pv(new_device) }

        it "returns false" do
          expect(new_device.to_be_formatted?(fake_devicegraph)).to eq false
        end
      end

      context "if it was not empty in the original devicegraph" do
        let(:device_name) { "/dev/sda1" }

        before do
          new_device.remove_descendants
          vg1.add_lvm_pv(new_device)
        end

        it "returns false" do
          expect(new_device.to_be_formatted?(fake_devicegraph)).to eq false
        end
      end
    end
  end

  describe "#basename" do
    let(:device_name) { "/dev/sda1" }

    it "returns the basename of the device's name" do
      expect(device.basename).to eq("sda1")
    end
  end

  describe "#path_for_mount_by" do
    let(:device_name) { "/dev/sda1" }

    context "when mounting by device" do
      let(:mount_by) { Y2Storage::Filesystems::MountByType::DEVICE }

      it "returns the kernel name" do
        expect(subject.path_for_mount_by(mount_by)).to eq(device_name)
      end
    end

    context "when mounting by UUID" do
      let(:mount_by) { Y2Storage::Filesystems::MountByType::UUID }

      context "and the device contains a filesystem with uuid" do
        before { subject.filesystem.uuid = "111222333444" }

        it "returns nil" do
          expect(subject.path_for_mount_by(mount_by)).to be_nil
        end
      end

      context "and the device contains no filesystem" do
        before { subject.remove_descendants }

        it "returns nil" do
          expect(subject.path_for_mount_by(mount_by)).to be_nil
        end
      end

      context "and the device is an MD" do
        let(:scenario) { "md-imsm1-devicegraph.xml" }
        let(:device_name) { "/dev/md/a" }

        context "with uuid" do
          it "returns the by-uuid udev path" do
            expect(subject.path_for_mount_by(mount_by))
              .to eq "/dev/disk/by-uuid/8f600ff3:ccc9872c:539cd6c8:91e3b4a1"
          end
        end

        context "with not uuid defined yet" do
          before { allow(subject).to receive(:uuid).and_return("") }

          it "returns nil" do
            expect(subject.path_for_mount_by(mount_by)).to be_nil
          end
        end
      end

      context "and the device is a LUKS" do
        let(:device_name) { "/dev/mapper/cr_sda4" }

        context "with uuid" do
          before { allow(subject).to receive(:uuid).and_return("111222333444") }

          it "returns the by-uuid udev path" do
            expect(subject.path_for_mount_by(mount_by)).to eq "/dev/disk/by-uuid/111222333444"
          end
        end

        context "with not uuid defined yet" do
          it "returns nil" do
            expect(subject.path_for_mount_by(mount_by)).to be_nil
          end
        end
      end
    end

    context "when mounting by label" do
      let(:mount_by) { Y2Storage::Filesystems::MountByType::LABEL }

      context "and the device contains a filesystem with a label" do
        it "returns nil" do
          expect(subject.filesystem.label).to_not be_empty
          expect(subject.path_for_mount_by(mount_by)).to be_nil
        end
      end

      context "and the device contains a filesystem with no label" do
        before { subject.filesystem.label = "" }

        it "returns nil" do
          expect(subject.path_for_mount_by(mount_by)).to be_nil
        end
      end

      context "and the device contains no filesystem" do
        before { subject.remove_descendants }

        it "returns nil" do
          expect(subject.path_for_mount_by(mount_by)).to be_nil
        end
      end
    end

    context "when mounting by path" do
      let(:mount_by) { Y2Storage::Filesystems::MountByType::PATH }

      context "and the device has by-path udev paths" do
        before do
          allow(subject).to receive(:udev_full_paths).and_return [path_by_path1, path_by_path2]
        end

        let(:path_by_path1) { "/dev/disk/by-path/pci1111-part1" }
        let(:path_by_path2) { "/dev/disk/by-path/pci2222-part1" }

        it "returns the first by-path udev path" do
          expect(subject.path_for_mount_by(mount_by)).to eq(path_by_path1)
        end
      end

      context "and the device has no by-path udev paths" do
        before do
          allow(subject).to receive(:udev_full_paths).and_return []
        end

        it "returns nil" do
          expect(subject.path_for_mount_by(mount_by)).to be_nil
        end
      end

      context "and the device is a LUKS" do
        let(:device_name) { "/dev/mapper/cr_sda4" }

        it "returns nil" do
          expect(subject.path_for_mount_by(mount_by)).to be_nil
        end
      end

      context "and the device is an MD" do
        let(:scenario) { "md-imsm1-devicegraph.xml" }
        let(:device_name) { "/dev/md/a" }

        it "returns nil" do
          expect(subject.path_for_mount_by(mount_by)).to be_nil
        end
      end
    end
  end

  describe "#udev_full_paths" do
    let(:device_name) { "/dev/sda1" }
    before { allow(device).to receive(:udev_paths).and_return(paths) }

    context "for devices with no known udev paths" do
      let(:paths) { [] }

      it "returns an empty array" do
        expect(device.udev_full_paths).to eq []
      end
    end

    context "for devices with several udev paths" do
      let(:paths) { ["pci-0000:00:1f.2-ata-1", "pci-0000:00:1f.2-scsi-0:0:0:0"] }

      it "returns an array" do
        expect(device.udev_full_paths).to be_an Array
      end

      it "prepends '/dev/disk/by-path' to every path" do
        expect(device.udev_full_paths).to contain_exactly(
          "/dev/disk/by-path/pci-0000:00:1f.2-ata-1",
          "/dev/disk/by-path/pci-0000:00:1f.2-scsi-0:0:0:0"
        )
      end
    end
  end

  describe "#udev_full_ids" do
    let(:device_name) { "/dev/sda1" }
    before { allow(device).to receive(:udev_ids).and_return(ids) }

    context "for devices with no known udev ids" do
      let(:ids) { [] }

      it "returns an empty array" do
        expect(device.udev_full_ids).to eq []
      end
    end

    context "for devices with several udev ids" do
      let(:ids) { ["ata-HGST_HTS725050A7E630_TF655AWHGATD2L", "wwn-0x5000cca77fc4e744"] }

      it "returns an array" do
        expect(device.udev_full_ids).to be_an Array
      end

      it "prepends '/dev/disk/by-id' to every id" do
        expect(device.udev_full_ids).to contain_exactly(
          "/dev/disk/by-id/ata-HGST_HTS725050A7E630_TF655AWHGATD2L",
          "/dev/disk/by-id/wwn-0x5000cca77fc4e744"
        )
      end
    end
  end

  describe "#udev_full_label" do
    let(:device_name) { "/dev/sda1" }
    before { allow(device).to receive(:blk_filesystem).and_return(filesystem) }

    context "for devices without filesystem" do
      let(:filesystem) { nil }

      it "returns nil" do
        expect(device.udev_full_label).to eq nil
      end
    end

    context "for devices without label" do
      let(:filesystem) { double(label: "") }

      it "returns nil" do
        expect(device.udev_full_label).to eq nil
      end
    end

    context "for devices with a label" do
      let(:filesystem) { double(label: "DATA") }

      it "returns an string" do
        expect(device.udev_full_label).to be_an String
      end

      it "prepends '/dev/disk/by-label' to the label" do
        expect(device.udev_full_label).to eq(
          "/dev/disk/by-label/DATA"
        )
      end
    end
  end

  describe "#udev_full_uuid" do
    let(:device_name) { "/dev/sda1" }
    before { allow(device).to receive(:blk_filesystem).and_return(filesystem) }

    context "for devices without filesystem" do
      let(:filesystem) { nil }

      it "returns nil" do
        expect(device.udev_full_uuid).to eq nil
      end
    end

    context "for devices without uuid" do
      let(:filesystem) { double(uuid: "") }

      it "returns nil" do
        expect(device.udev_full_uuid).to eq nil
      end
    end

    context "for devices with a uuid" do
      let(:filesystem) { double(uuid: "DATA") }

      it "returns an string" do
        expect(device.udev_full_uuid).to be_an String
      end

      it "prepends '/dev/disk/by-uuid' to the uuid" do
        expect(device.udev_full_uuid).to eq(
          "/dev/disk/by-uuid/DATA"
        )
      end
    end
  end

  describe "#udev_full_all" do
    let(:device_name) { "/dev/sda1" }
    before do
      allow(device).to receive(:blk_filesystem).and_return(double(label: "DATA", uuid: ""))
      allow(device).to receive(:udev_ids).and_return([])
      allow(device).to receive(:udev_paths).and_return(
        ["pci-0000:00:1f.2-ata-1", "pci-0000:00:1f.2-scsi-0:0:0:0"]
      )
    end

    it "returns array" do
      expect(device.udev_full_all).to be_an Array
    end

    it "does not contain any nil" do
      expect(device.udev_full_all).to_not include(nil)
    end

    it "contains all full udev links" do
      expect(device.udev_full_all).to contain_exactly(
        "/dev/disk/by-path/pci-0000:00:1f.2-ata-1",
        "/dev/disk/by-path/pci-0000:00:1f.2-scsi-0:0:0:0",
        "/dev/disk/by-label/DATA"
      )
    end
  end

  describe "#md" do
    before { fake_scenario("subvolumes-and-empty-md.xml") }

    context "for a device directly used in an MD array" do
      let(:device_name) { "/dev/sda4" }

      it "returns the Md device" do
        expect(device.md).to be_a Y2Storage::Md
        expect(device.md.devices).to include device
      end
    end

    context "for a device encrypted and used in an MD array" do
      let(:device_name) { "/dev/sda5" }

      it "returns the Md device" do
        expect(device.md).to be_a Y2Storage::Md
        expect(device.md.devices).to include device.encryption
      end
    end

    context "for a device that is not part of any MD array" do
      let(:device_name) { "/dev/sda3" }

      it "returns nil" do
        expect(device.md).to be_nil
      end
    end
  end

  describe "#direct_md" do
    before { fake_scenario("subvolumes-and-empty-md.xml") }

    context "for a device directly used in an MD array" do
      let(:device_name) { "/dev/sda4" }

      it "returns the Md device" do
        expect(device.direct_md).to be_a Y2Storage::Md
        expect(device.direct_md.devices).to include device
      end
    end

    context "for a device encrypted and used in an MD array" do
      let(:device_name) { "/dev/sda5" }

      it "returns nil" do
        expect(device.direct_md).to be_nil
      end
    end

    context "for a device that is not part of any MD array" do
      let(:device_name) { "/dev/sda3" }

      it "returns nil" do
        expect(device.direct_md).to be_nil
      end
    end
  end

  describe "#part_of_lvm_or_md?" do
    context "for a device not used in an LVM or in a MD RAID" do
      let(:scenario) { "mixed_disks" }
      let(:device_name) { "/dev/sda1" }

      it "returns false" do
        expect(device.part_of_lvm_or_md?).to eq(false)
      end
    end

    context "for a device directly used in an LVM" do
      let(:scenario) { "complex-lvm-encrypt" }
      let(:device_name) { "/dev/sde2" }

      it "returns true" do
        expect(device.part_of_lvm_or_md?).to eq(true)
      end
    end

    context "for an encrypted device directly used in an LVM" do
      let(:scenario) { "complex-lvm-encrypt" }
      let(:device_name) { "/dev/sde1" }

      it "returns true" do
        expect(device.part_of_lvm_or_md?).to eq(true)
      end
    end

    context "for a device not directly used in an LVM" do
      let(:scenario) { "complex-lvm-encrypt" }
      let(:device_name) { "/dev/sde" }

      it "returns false" do
        expect(device.part_of_lvm_or_md?).to eq(false)
      end
    end

    context "for a device directly used in an MD RAID" do
      let(:scenario) { "subvolumes-and-empty-md.xml" }
      let(:device_name) { "/dev/sda4" }

      it "returns true" do
        expect(device.part_of_lvm_or_md?).to eq(true)
      end
    end

    context "for an encrypted device directly used in an MD RAID" do
      let(:scenario) { "subvolumes-and-empty-md.xml" }
      let(:device_name) { "/dev/sda5" }

      it "returns true" do
        expect(device.part_of_lvm_or_md?).to eq(true)
      end
    end

    context "for a device not directly used in an MD RAID" do
      let(:scenario) { "subvolumes-and-empty-md.xml" }
      let(:device_name) { "/dev/sda" }

      it "returns false" do
        expect(device.part_of_lvm_or_md?).to eq(false)
      end
    end
  end

  describe "#bcache" do
    let(:scenario) { "bcache2.xml" }

    context "when the device is not used as backing device by a bcache" do
      let(:device_name) { "/dev/sdb3" }

      it "returns nil" do
        expect(device.bcache).to be_nil
      end
    end

    context "when the device is used as backing device by a bcache" do
      let(:device_name) { "/dev/sdb2" }

      it "returns the bcache device" do
        bcache = device.bcache

        expect(bcache).to be_a(Y2Storage::Bcache)
        expect(bcache.type).to eq(Y2Storage::BcacheType::BACKED)
        expect(bcache.name).to eq("/dev/bcache0")
      end
    end

    context "when the device is used as caching device and the cset has flash-only bcaches" do
      let(:device_name) { "/dev/sdb1" }

      it "does not return the flash-only bcache device" do
        cset = device.in_bcache_cset

        expect(cset.bcaches.any? { |d| d.type == Y2Storage::BcacheType::FLASH_ONLY }).to eq(true)
        expect(device.bcache).to be_nil
      end
    end
  end

  describe "#component_of" do
    context "for a device not used in an LVM or in a RAID or in multipath or in a Btrfs multidevice" do
      let(:scenario) { "mixed_disks" }
      let(:device_name) { "/dev/sda1" }

      it "returns an empty array" do
        expect(device.component_of).to eq []
      end
    end

    context "for a device that is part of several DM RAIDs" do
      let(:scenario) { "empty-dm_raids.xml" }
      let(:device_name) { "/dev/sdb" }

      it "returns an array with all the corresponding DM RAIDs" do
        expect(device.component_of.size).to eq 2
        expect(device.component_of).to all(be_a(Y2Storage::DmRaid))
        expect(device.component_of.map(&:name)).to contain_exactly(
          "/dev/mapper/isw_ddgdcbibhd_test1", "/dev/mapper/isw_ddgdcbibhd_test2"
        )
      end
    end

    context "for a device directly used in an LVM" do
      let(:scenario) { "complex-lvm-encrypt" }
      let(:device_name) { "/dev/sde2" }

      it "returns an array with the LVM VG" do
        expect(device.component_of.size).to eq 1
        expect(device.component_of.first).to be_a Y2Storage::LvmVg
        expect(device.component_of.first.name).to eq "/dev/vg1"
      end
    end

    context "for an encrypted device directly used in an LVM" do
      let(:scenario) { "complex-lvm-encrypt" }
      let(:device_name) { "/dev/sde1" }

      it "returns an array with the LVM VG" do
        expect(device.component_of.size).to eq 1
        expect(device.component_of.first).to be_a Y2Storage::LvmVg
        expect(device.component_of.first.name).to eq "/dev/vg0"
      end
    end

    context "for a disk used indirectly (through its partitions) in an LVM" do
      let(:scenario) { "complex-lvm-encrypt" }
      let(:device_name) { "/dev/sde" }

      it "returns an empty array" do
        expect(device.component_of).to eq []
      end
    end

    context "for a device directly used in an MD RAID" do
      let(:scenario) { "subvolumes-and-empty-md.xml" }
      let(:device_name) { "/dev/sda4" }

      it "returns an array with the MD RAID" do
        expect(device.component_of.size).to eq 1
        expect(device.component_of.first).to be_a Y2Storage::Md
        expect(device.component_of.first.name).to eq "/dev/md/strip0"
      end
    end

    context "for an encrypted device directly used in an MD RAID" do
      let(:scenario) { "subvolumes-and-empty-md.xml" }
      let(:device_name) { "/dev/sda5" }

      it "returns an array with the MD RAID" do
        expect(device.component_of.size).to eq 1
        expect(device.component_of.first).to be_a Y2Storage::Md
        expect(device.component_of.first.name).to eq "/dev/md/strip0"
      end
    end

    context "for a disk used indirectly (through its partitions) in an MD RAID" do
      let(:scenario) { "subvolumes-and-empty-md.xml" }
      let(:device_name) { "/dev/sda" }

      it "returns an empty array" do
        expect(device.component_of).to eq []
      end
    end

    context "for a disk that is part of a multipath setup" do
      let(:scenario) { "multipath-formatted.xml" }
      let(:device_name) { "/dev/sda" }

      it "returns an array with the multipath device" do
        expect(device.component_of.size).to eq 1
        expect(device.component_of.first).to be_a Y2Storage::Multipath
        expect(device.component_of.first.name).to eq "/dev/mapper/0QEMU_QEMU_HARDDISK_mpath1"
      end
    end

    context "for a disk that is used as backing device for a bcache" do
      let(:scenario) { "bcache1.xml" }
      let(:device_name) { "/dev/vdc" }

      it "returns an array with the bcache device" do
        expect(device.component_of.size).to eq 1
        expect(device.component_of.first).to be_a Y2Storage::Bcache
        expect(device.component_of.first.name).to eq "/dev/bcache0"
      end
    end

    context "for a disk that is used as caching device for a bcache" do
      let(:scenario) { "bcache1.xml" }
      let(:device_name) { "/dev/vdb" }

      it "returns an array with the bcache cset device" do
        expect(device.component_of.size).to eq 1
        expect(device.component_of.first).to be_a Y2Storage::BcacheCset
        expect(device.component_of.first.uuid).to eq "acb129b8-b55e-45bb-aa99-41a6f0a0ef07"
      end
    end

    context "for a bcache device not used in an LVM or in a RAID" do
      let(:scenario) { "bcache1.xml" }
      let(:device_name) { "/dev/bcache0" }

      # Regression test, at some point this used to return the bcache_cset of the
      # bcache device, which was obviously wrong (all bcaches were somehow
      # considered to be a component of their own cset!).
      it "returns an empty array" do
        expect(device.component_of).to eq []
      end
    end

    context "for a device directly used in an multidevice Btrfs filesystem" do
      let(:scenario) { "btrfs2-devicegraph.xml" }
      let(:device_name) { "/dev/sdb1" }

      it "returns an array with the Btrfs filesystems" do
        expect(device.component_of.size).to eq 1
        expect(device.component_of.first).to be_a Y2Storage::Filesystems::Btrfs
      end
    end
  end

  describe "#component_of_names" do
    let(:scenario) { "bcache1.xml" }
    let(:device_name) { "/dev/vdb" }

    it "returns the display name of the component devices" do
      expect(device.component_of_names.size).to eq(1)
      expect(device.component_of_names).to contain_exactly("Cache set (bcache0, bcache1, bcache2)")
    end
  end

  describe "#hwinfo" do
    let(:device_name) { "/dev/sda" }

    before do
      allow(Y2Storage::HWInfoReader.instance).to receive(:for_device)
        .with(device.name)
        .and_return(hwinfo)
    end

    context "when hardware info is available" do
      let(:hwinfo) { Y2Storage::HWInfoDisk.new(driver_modules: ["ahci", "sd"]) }

      it "returns the hardware info" do
        expect(device.hwinfo).to eq(hwinfo)
      end
    end

    context "when hardware info is not available" do
      let(:hwinfo) { nil }

      it "returns nil" do
        expect(device.hwinfo).to eq(nil)
      end
    end
  end

  describe "#vendor" do
    let(:device_name) { "/dev/sda" }

    before do
      allow(Y2Storage::HWInfoReader.instance).to receive(:for_device)
        .with(device.name)
        .and_return(hwinfo)
    end

    context "when hardware info is available" do
      let(:hwinfo) { Y2Storage::HWInfoDisk.new(info) }

      context "and there is info about the vendor" do
        let(:info) { { vendor: vendor_name } }

        let(:vendor_name) { "vendor-name" }

        it "returns the vendor name" do
          expect(device.vendor).to eq(vendor_name)
        end
      end

      context "and there is no info about the vendor" do
        let(:info) { { bus: "" } }

        it "returns nil" do
          expect(device.vendor).to be_nil
        end
      end
    end

    context "when hardware info is not available" do
      let(:hwinfo) { Y2Storage::HWInfoDisk.new }

      it "returns nil" do
        expect(device.vendor).to be_nil
      end
    end
  end

  describe "#model" do
    let(:device_name) { "/dev/sda" }

    before do
      allow(Y2Storage::HWInfoReader.instance).to receive(:for_device)
        .with(device.name)
        .and_return(hwinfo)
    end

    context "when hardware info is available" do
      let(:hwinfo) { Y2Storage::HWInfoDisk.new(info) }

      context "and there is info about the model" do
        let(:info) { { model: device_model } }

        let(:device_model) { "device-model" }

        it "returns the device model" do
          expect(device.model).to eq(device_model)
        end
      end

      context "and there is no info about the model" do
        let(:info) { { bus: "" } }

        it "returns nil" do
          expect(device.model).to be_nil
        end
      end
    end
  end

  describe "#bus" do
    let(:device_name) { "/dev/sda" }

    before do
      allow(Y2Storage::HWInfoReader.instance).to receive(:for_device)
        .with(device.name)
        .and_return(hwinfo)
    end

    context "when hardware info is available" do
      let(:hwinfo) { Y2Storage::HWInfoDisk.new(info) }

      context "and there is info about the bus" do
        let(:info) { { bus: device_bus } }

        let(:device_bus) { "device-bus" }

        it "returns the device bus" do
          expect(device.bus).to eq(device_bus)
        end
      end

      context "and there is no info about the bus" do
        let(:info) { { model: "device-model" } }

        it "returns nil" do
          expect(device.bus).to be_nil
        end
      end
    end

    context "when hardware info is not available" do
      let(:hwinfo) { Y2Storage::HWInfoDisk.new }

      it "returns nil" do
        expect(device.bus).to be_nil
      end
    end
  end

  describe "#boss?" do
    let(:device_name) { "/dev/sda" }

    before { allow(device).to receive(:model).and_return model }

    context "when no model information is available" do
      let(:model) { nil }

      it "returns false" do
        expect(device.boss?).to eq false
      end
    end

    context "when the model information is empty" do
      let(:model) { "" }

      it "returns false" do
        expect(device.boss?).to eq false
      end
    end

    # Original criteria provided by Dell at jsc#SLE-17578
    context "when the model contains DELLBOSS" do
      let(:model) { "A DELLBOSS device" }

      it "returns true" do
        expect(device.boss?).to eq true
      end
    end

    # Used in some models like the one reported as bsc#1200975
    context "when the model contains 'Dell BOSS'" do
      let(:model) { "Dell BOSS-N1 Modular" }

      it "returns true" do
        expect(device.boss?).to eq true
      end
    end

    # Hypothetical string based on the criteria exposed at comment#84 of bsc#1200975
    context "when the model contains first 'BOSS' and then 'Dell'" do
      let(:model) { "Cool BOSS device by Dell" }

      it "returns true" do
        expect(device.boss?).to eq true
      end
    end

    context "when the model contains 'Dell' but not 'BOSS'" do
      let(:model) { "Dell controller" }

      it "returns false" do
        expect(device.boss?).to eq false
      end
    end

    context "when the model contains 'BOSS' but not 'Dell'" do
      let(:model) { "BOSS as Back Office Support System" }

      it "returns false" do
        expect(device.boss?).to eq false
      end
    end
  end

  describe ".sorted_by_name" do
    let(:scenario) { "sorting/disks_and_dasds1" }

    it "returns all the blk devices sorted by name" do
      devices = Y2Storage::BlkDevice.sorted_by_name(fake_devicegraph)
      expect(devices.map(&:basename)).to eq %w[
        dasda dasda1 dasda2 dasda10 dasdb dasdb1 dasdb2 dasdb3 dasdab
        nvme0n1 nvme0n1p1 nvme0n1p2 nvme0n1p3 nvme0n1p4 nvme0n1p10 nvme0n1p11 nvme0n1p40
        nvme0n2 nvme0n2p1 nvme0n2p2 nvme1n1 nvme1n1p1 nvme1n1p2
        sda sdb sdb1 sdb2 sdc sdc1 sdc2 sdc3 sdc4 sdc10 sdc21 sdaa sdaa1 sdaa2 sdaa3
      ]
    end
  end

  describe "#compare_by_name" do
    context "when devices of different types share a common name structure" do
      let(:scenario) { "sorting/disks_and_dasds2" }

      let(:vda) { Y2Storage::Disk.find_by_name(fake_devicegraph, "/dev/vda") }
      let(:vdaa) { Y2Storage::Dasd.find_by_name(fake_devicegraph, "/dev/vdaa") }
      let(:vdb) { Y2Storage::Disk.find_by_name(fake_devicegraph, "/dev/vdb") }

      it "allows to sort them by name, no matter the input order" do
        [vda, vdaa, vdb].permutation do |input|
          expect(input.sort { |a, b| a.compare_by_name(b) }).to eq [vda, vdb, vdaa]
        end
      end
    end
  end

  # This is mostly a direct forward to libstorage-ng, but this test is here
  # because Storage::BlkDevice#find_by_any_name does not follow the usual
  # libstorage-ng convention for exceptions.
  describe "find_by_any_name" do
    # The libstorage-ng counterpart of this method performs a real lookup in the
    # system, so this can hardly be tested without a lot of mocking.
    let(:storage_class) { Storage::BlkDevice }
    let(:name) { "/dev/something" }

    context "when libstorage-ng returns an object" do
      let(:storage_device) do
        Storage::BlkDevice.find_by_name(fake_devicegraph.to_storage_value, "/dev/sda")
      end

      it "returns the Y2Storage wrapped version of that object" do
        expect(storage_class).to receive(:find_by_any_name).with(fake_devicegraph, name)
          .and_return(storage_device)

        result = described_class.find_by_any_name(fake_devicegraph, name)
        expect(result).to be_a described_class
        expect(result.to_storage_value).to eq storage_device
      end
    end

    context "when libstorage-ng throws a DeviceNotFoundByName exception" do
      before do
        allow(storage_class).to receive(:find_by_any_name) do
          raise Storage::DeviceNotFoundByName, "A libstorage-ng error"
        end
      end

      it "returns nil" do
        expect(described_class.find_by_any_name(fake_devicegraph, name)).to be_nil
      end
    end

    context "when libstorage-ng throws a DeviceHasWrongType exception" do
      before do
        allow(storage_class).to receive(:find_by_any_name) do
          raise Storage::DeviceHasWrongType.new("A libstorage-ng error", "")
        end
      end

      it "returns nil" do
        expect(described_class.find_by_any_name(fake_devicegraph, name)).to be_nil
      end
    end

    context "when libstorage-ng throws a general Storage exception (wrong devicegraph)" do
      before do
        allow(storage_class).to receive(:find_by_any_name) do
          raise Storage::Exception, "A libstorage-ng error"
        end
      end

      it "propagates the exception" do
        expect { described_class.find_by_any_name(fake_devicegraph, name) }
          .to raise_error Storage::Exception
      end
    end
  end

  describe "#encrypt" do
    let(:device_name) { "/dev/sdb" }

    RSpec.shared_examples "given encryption name" do
      it "creates an encryption device with the given name and no #auto_dm_name?" do
        expect(enc).to be_a Y2Storage::Encryption
        expect(enc.blk_device).to eq device
        expect(enc.dm_table_name).to eq "cr_manual"
        expect(enc.name).to eq "/dev/mapper/cr_manual"
        expect(enc.auto_dm_name?).to eq false
      end
    end

    RSpec.shared_examples "auto-generated encryption name" do
      before do
        allow_any_instance_of(Y2Storage::Encryption)
          .to receive(:auto_dm_table_name).and_return("cr_auto")
      end

      it "creates an encryption device with an auto-generated name and #auto_dm_name?" do
        expect(enc).to be_a Y2Storage::Encryption
        expect(enc.blk_device).to eq device
        expect(enc.dm_table_name).to eq "cr_auto"
        expect(enc.name).to eq "/dev/mapper/cr_auto"
        expect(enc.auto_dm_name?).to eq true
      end
    end

    RSpec.shared_examples "given password" do
      it "sets the correct password for the encrypted device" do
        expect(enc.password).to eq "123123"
      end
    end

    RSpec.shared_examples "no password" do
      it "sets no password for the encrypted device" do
        expect(enc.password).to eq ""
      end
    end

    RSpec.shared_examples "default method" do
      it "creates an encryption device using LUKS1 as default encryption method" do
        expect(enc).to be_a Y2Storage::Encryption
        expect(enc.method).to eq(Y2Storage::EncryptionMethod::LUKS1)
      end
    end

    RSpec.shared_examples "given method" do
      it "creates an encryption device using the given encryption method" do
        expect(enc).to be_a Y2Storage::Encryption
        expect(enc.method).to eq(method)
      end
    end

    context "when called with no arguments" do
      let(:enc) { device.encrypt }

      include_examples "auto-generated encryption name"
      include_examples "no password"
      include_examples "default method"
    end

    context "when a method is provided" do
      let(:method) { Y2Storage::EncryptionMethod::RANDOM_SWAP }
      let(:enc) { device.encrypt(dm_name: "cr_manual", method: method) }

      include_examples "given method"

      context "and the method is pervasive encryption" do
        before { allow(Yast::Execute).to receive(:locally).with(/zkey/, any_args) }

        let(:method) { Y2Storage::EncryptionMethod::PERVASIVE_LUKS2 }

        let(:apqn) { instance_double(Y2Storage::EncryptionProcesses::Apqn, name: "01.0001") }

        it "creates the encryption with the given APQNs" do
          enc = device.encrypt(dm_name: "cr_manual", method: method, apqns: [apqn])

          expect(enc).to be_a Y2Storage::Encryption
          expect(enc.encryption_process.apqns).to contain_exactly(apqn)
        end
      end
    end

    context "when a name is provided with no password" do
      let(:enc) { device.encrypt(dm_name: "cr_manual") }

      include_examples "given encryption name"
      include_examples "no password"
    end

    context "when a password is provided with no name" do
      let(:enc) { device.encrypt(password: "123123") }

      include_examples "auto-generated encryption name"
      include_examples "given password"
    end

    context "when a method is provided (via its symbol)" do
      let(:method) { Y2Storage::EncryptionMethod::RANDOM_SWAP }
      let(:enc) { device.encrypt(method: method.to_sym) }

      include_examples "given method"
    end

    context "auto-generated names" do
      # Helper method to check for collisions in the DeviceMapper names
      def expect_no_dm_duplicates
        all_dm_names = devicegraph.blk_devices.map(&:dm_table_name).reject(&:empty?).sort
        uniq_dm_names = all_dm_names.uniq
        expect(all_dm_names).to eq uniq_dm_names
      end

      # Helper method to find a partition by number
      def partition(disk, number)
        disk.partitions.find { |part| part.number == number }
      end

      # Helper method to delete a given partition from a disk
      def delete_partition(disk, number)
        disk.partition_table.delete_partition(partition(disk, number))
      end

      # Helper method to create a partition with an encryption device,
      # using #encrypt with auto-generated name.
      def create_encrypted_partition(disk, slot_index)
        slot = disk.partition_table.unused_partition_slots[slot_index]
        region = Y2Storage::Region.create(slot.region.start, 8192, slot.region.block_size)
        part = disk.partition_table.create_partition(
          slot.name, region, Y2Storage::PartitionType::PRIMARY
        )
        part.encrypt
      end

      let(:scenario) { "trivial_lvm_and_other_partitions" }
      let(:devicegraph) { Y2Storage::StorageManager.instance.staging }
      let(:sda) { devicegraph.find_by_name("/dev/sda") }

      context "when the numbers assigned to partitions change" do
        before do
          # Let's free some slots at the beginning of the disk
          delete_partition(sda, 1)
          delete_partition(sda, 2)
        end

        # Regression test for bsc#1094157
        it "does not generate redundant DeviceMapper names" do
          # Generate encryption devices for two new partitions sda1 and sda2
          # at the beginning of the disk
          create_encrypted_partition(sda, 0)
          create_encrypted_partition(sda, 0)
          # Remove the first new partition so the current sda2 becomes sda1
          delete_partition(sda, 1)
          # Add a new sda2
          create_encrypted_partition(sda, 1)

          expect_no_dm_duplicates
        end
      end

      context "when the candidate name is already taken" do
        let(:sda2) { partition(sda, 2) }
        let(:sda3) { partition(sda, 3) }

        before do
          # Ensure the first option for the name is already taken
          sda2.encrypt
          sda3.encryption.dm_table_name = sda2.dm_table_name

          sda2.remove_encryption
        end

        it "does not generate redundant DeviceMapper names" do
          sda2.encrypt

          expect_no_dm_duplicates
        end
      end
    end
  end

  describe "#windows_suitable?" do
    let(:device_name) { "/dev/sdb" }

    it "returns false" do
      expect(subject.windows_suitable?).to eq(false)
    end
  end

  describe "#preferred_name" do
    let(:scenario) { "md-imsm1-devicegraph.xml" }
    let(:device_name) { "/dev/sda1" }

    let(:by_device) { Y2Storage::Filesystems::MountByType::DEVICE }
    let(:by_path) { Y2Storage::Filesystems::MountByType::PATH }
    let(:by_id) { Y2Storage::Filesystems::MountByType::ID }
    let(:all_suitable) { [by_device, by_path, by_id] }

    it "returns the best name from all the suitable ones" do
      expect(Y2Storage::Filesystems::MountByType).to receive(:best_for)
        .with(device, all_suitable).and_return(by_path)

      expect(device.preferred_name).to eq "/dev/disk/by-path/pci-0000:00:1f.2-ata-1-part1"
    end
  end
end
