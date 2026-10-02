#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2020] SUSE LLC
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

describe Y2Storage::Filesystems::BlkFilesystem do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)
  end
  let(:scenario) { "mixed_disks_btrfs" }
  let(:blk_device) { Y2Storage::BlkDevice.find_by_name(fake_devicegraph, dev_name) }
  let(:btrfs_part) { "/dev/sdb2" }
  let(:xfs_part)   { "/dev/sdb5" }
  let(:ntfs_part)  { "/dev/sda1" }
  subject(:filesystem) { blk_device.blk_filesystem }

  describe "#blk_device_basename" do
    context "for a non-multidevice filesystem" do
      let(:scenario) { "mixed_disks" }

      let(:dev_name) { "/dev/sdb2" }

      it "returns the base name of its block device" do
        expect(subject.blk_device_basename).to eq("sdb2")
      end
    end

    context "for a multidevice filesystem" do
      let(:scenario) { "btrfs2-devicegraph.xml" }

      let(:dev_name) { "/dev/sdb1" }

      it "returns the base name of its first block device between brackets" do
        # NOTE: that must be the first block device base name after sort them alphabetically,
        # so "(sdb1...)" is expected
        expect(subject.blk_device_basename).to match(/\(sdb1.*\)/)
      end
    end
  end

  describe "#multidevice?" do
    context "when the filesystem is over one device only" do
      let(:dev_name) { "/dev/sdb2" }

      it "returns false" do
        expect(subject.multidevice?).to eq(false)
      end
    end

    context "when the filesystem is over several devices" do
      let(:scenario) { "btrfs2-devicegraph.xml" }

      let(:dev_name) { "/dev/sdb1" }

      it "returns true" do
        expect(subject.multidevice?).to eq(true)
      end
    end
  end

  describe "#journal_device" do
    context "when the filesystem does not have an external journal" do
      let(:scenario) { "mixed_disks" }

      let(:dev_name) { "/dev/sdb3" }

      it "returns nil" do
        expect(subject.journal_device).to be_nil
      end
    end

    context "when the filesystem has an external journal" do
      let(:scenario) { "bug_1145841.xml" }

      let(:dev_name) { "/dev/BACKUP_R6/BACKUP_R6" }

      it "returns the device used to hold the journal" do
        expect(subject.journal_device.is_a?(Y2Storage::BlkDevice)).to eq(true)
      end
    end
  end

  describe "#supports_btrfs_subvolumes?" do
    context "for a Btrfs filesystem" do
      let(:dev_name) { btrfs_part }

      it "returns true" do
        expect(filesystem.supports_btrfs_subvolumes?).to eq true
      end
    end

    context "for a non-Btrfs filesystem" do
      let(:dev_name) { xfs_part }

      it "returns false" do
        expect(filesystem.supports_btrfs_subvolumes?).to eq false
      end
    end
  end

  describe "#supports_grow?" do
    context "for a Btrfs filesystem" do
      let(:dev_name) { btrfs_part }

      it "returns true" do
        expect(filesystem.supports_grow?).to eq true
      end
    end

    context "for an XFS filesystem" do
      let(:dev_name) { xfs_part }

      it "returns false" do
        expect(filesystem.supports_grow?).to eq true
      end
    end

    context "for an NTFS filesystem" do
      let(:dev_name) { ntfs_part }

      it "returns true" do
        expect(filesystem.supports_grow?).to eq true
      end
    end
  end

  describe "#supports_shrink?" do
    context "for a Btrfs filesystem" do
      let(:dev_name) { btrfs_part }

      it "returns true" do
        expect(filesystem.supports_shrink?).to eq true
      end
    end

    context "for an XFS filesystem" do
      let(:dev_name) { xfs_part }

      it "returns true" do
        expect(filesystem.supports_shrink?).to eq false
      end
    end

    context "for an NTFS filesystem" do
      let(:dev_name) { ntfs_part }

      it "returns true" do
        expect(filesystem.supports_shrink?).to eq true
      end
    end
  end

  describe "#mount_path" do
    context "when filesystem has no mount point" do
      let(:dev_name) { "/dev/sdb3" }

      it "returns nil" do
        expect(filesystem.mount_path).to be_nil
      end
    end

    context "when filesystem has a mount point" do
      let(:dev_name) { "/dev/sda2" }

      it "returns the mount point path" do
        expect(filesystem.mount_path).to eq("/")
      end
    end
  end

  describe "#mount_path=" do
    context "when filesystem has no mount point" do
      let(:dev_name) { "/dev/sdb3" }

      it "creates a new mount point with the given path" do
        expect(filesystem.mount_point).to be_nil

        filesystem.mount_path = "/foo"

        expect(filesystem.mount_point).to_not be_nil
        expect(filesystem.mount_point.path).to eq("/foo")
      end
    end

    context "when filesystem has a mount point" do
      let(:dev_name) { "/dev/sda2" }

      it "updates the mount point path" do
        mount_point = filesystem.mount_point
        filesystem.mount_path = "/foo"

        expect(filesystem.mount_point.sid).to eq(mount_point.sid)
        expect(filesystem.mount_point.path).to eq("/foo")
      end
    end
  end

  describe "#mount_by" do
    context "when filesystem has no mount point" do
      let(:dev_name) { "/dev/sdb3" }

      it "returns nil" do
        expect(filesystem.mount_by).to be_nil
      end
    end

    context "when filesystem has a mount point" do
      let(:dev_name) { "/dev/sda2" }

      before do
        filesystem.mount_point.mount_by = Y2Storage::Filesystems::MountByType::ID
      end

      it "returns the mount by of the mount point" do
        expect(filesystem.mount_by).to eq(Y2Storage::Filesystems::MountByType::ID)
      end
    end
  end

  describe "#preferred_name" do
    let(:scenario) { "mixed_disks" }
    let(:dev_name) { "/dev/sdb2" }

    context "when the filesystem contains a mount point" do
      context "but the path for the given mount_by cannot be calculated" do
        before do
          allow(Y2Storage::Filesystems::MountByType).to receive(:best_for)
            .with(subject, anything).and_return(Y2Storage::Filesystems::MountByType::LABEL)
        end

        it "returns the best udev name that can be calculated" do
          subject.uuid = ""
          subject.mount_point.mount_by = Y2Storage::Filesystems::MountByType::UUID

          expect(subject.preferred_name).to eq "/dev/disk/by-label/suse_root"
        end
      end

      context "and it's possible to honor the specified mount_by" do
        it "returns the udev name corresponding to the current mount_by" do
          subject.uuid = "12345678-90ab-cdef-1234-567890abcdef"
          subject.mount_point.mount_by = Y2Storage::Filesystems::MountByType::UUID
          expect(subject.preferred_name)
            .to eq "/dev/disk/by-uuid/12345678-90ab-cdef-1234-567890abcdef"

          subject.mount_point.mount_by = Y2Storage::Filesystems::MountByType::LABEL
          expect(subject.preferred_name).to eq "/dev/disk/by-label/suse_root"
        end
      end
    end

    context "when the filesystem is not mounted" do
      before do
        allow(Y2Storage::Filesystems::MountByType).to receive(:best_for)
          .with(subject, anything).and_return(
            Y2Storage::Filesystems::MountByType::LABEL, Y2Storage::Filesystems::MountByType::UUID
          )

        subject.remove_mount_point
        subject.uuid = "12345678-90ab-cdef-1234-567890abcdef"
      end

      it "returns the best udev name that can be calculated" do
        # According to the mock, the first call to #best_for returns LABEL...
        expect(subject.preferred_name).to eq "/dev/disk/by-label/suse_root"
        # ...and the second call returns UUID
        expect(subject.preferred_name)
          .to eq "/dev/disk/by-uuid/12345678-90ab-cdef-1234-567890abcdef"
      end
    end
  end

  describe "#mount_options" do
    context "when filesystem has no mount point" do
      let(:dev_name) { "/dev/sdb3" }

      it "returns an empty list" do
        expect(filesystem.mount_options).to be_empty
      end
    end

    context "when filesystem has a mount point" do
      let(:dev_name) { "/dev/sda2" }

      before do
        filesystem.mount_point.mount_options = mount_options
      end

      let(:mount_options) { ["rw", "minorversion=1"] }

      it "returns the mount options of the mount point" do
        expect(filesystem.mount_options).to eq(mount_options)
      end
    end
  end

  describe "#persistent?" do
    context "for not mounted filesystem" do
      let(:dev_name) { "/dev/sdb3" }

      it "returns false" do
        expect(filesystem.persistent?).to eq false
      end

      context "after adding a mount point" do
        before { filesystem.mount_path = "/mnt/test" }

        it "returns true" do
          expect(filesystem.persistent?).to eq true
        end
      end
    end
  end

  describe "#in_network?" do
    let(:disk) { Y2Storage::BlkDevice.find_by_name(fake_devicegraph, "/dev/sda") }

    context "for a single disk in network" do
      let(:dev_name) { "/dev/sda1" }
      before do
        allow(disk.transport).to receive(:network?).and_return(true)
      end

      it "returns true" do
        expect(filesystem.in_network?).to eq true
      end
    end

    context "for a single local disk" do
      before do
        allow(disk.transport).to receive(:network?).and_return(false)
      end
      let(:dev_name) { "/dev/sda1" }

      it "returns false" do
        expect(filesystem.in_network?).to eq false
      end
    end

    context "when filesystem has multiple ancestors and none is in network" do
      before do
        allow(filesystem).to receive(:ancestors).and_return([disk, second_disk])
        allow(disk).to receive(:in_network?).and_return(false)
        allow(second_disk).to receive(:in_network?).and_return(false)
      end
      let(:second_disk) { Y2Storage::BlkDevice.find_by_name(fake_devicegraph, "/dev/sdb") }
      let(:dev_name) { "/dev/sda1" }

      it "returns false" do
        expect(filesystem.in_network?).to eq false
      end
    end

    context "when filesystem has multiple ancestors and at least one disk is in network" do
      let(:scenario) { "btrfs-multidevice-over-partitions.xml" }
      let(:dev_name) { "/dev/sda2" }

      it "returns true" do
        expect(filesystem.in_network?).to eq true
      end
    end

    context "when the filesystem is in a logical volume of an encrypted LVM" do
      let(:scenario) { "complex-lvm-encrypt" }
      let(:dev_name) { "/dev/vg0/lv1" }
      let(:disk) { Y2Storage::BlkDevice.find_by_name(fake_devicegraph, "/dev/sdd") }

      before do
        allow(disk.transport).to receive(:network?).and_return network_transport
      end

      context "and the underlying disk is in the network" do
        let(:network_transport) { true }

        it "returns true" do
          expect(filesystem.in_network?).to eq true
        end
      end

      context "and the underlying disk is local" do
        let(:network_transport) { false }

        it "returns false" do
          expect(filesystem.in_network?).to eq false
        end
      end
    end
  end

  describe "#match_fstab_spec?" do
    let(:scenario) { "md-imsm1-devicegraph.xml" }
    let(:dev_name) { "/dev/sda2" }

    it "returns true for the correct kernel device name" do
      expect(filesystem.match_fstab_spec?("/dev/sda2")).to eq true
    end

    it "returns false for any other kernel device name" do
      expect(filesystem.match_fstab_spec?("/dev/sda")).to eq false
    end

    it "returns false for any NFS spec" do
      expect(filesystem.match_fstab_spec?("server:/path")).to eq false
    end

    it "returns true for the correct label using LABEL=" do
      expect(filesystem.match_fstab_spec?("LABEL=root")).to eq true
      # labels surrounded by quotes are considered also valid
      expect(filesystem.match_fstab_spec?("LABEL='root'")).to eq true
      expect(filesystem.match_fstab_spec?('LABEL="root"')).to eq true
    end

    it "returns false for the wrong label using LABEL=" do
      expect(filesystem.match_fstab_spec?("LABEL=no_label")).to eq false
    end

    it "always returns false 'LABEL=' (blank label)" do
      fs_with_no_label = fake_devicegraph.find_by_name("/dev/sda1").filesystem
      expect(filesystem.match_fstab_spec?("LABEL=")).to eq false
      expect(fs_with_no_label.match_fstab_spec?("LABEL=")).to eq false
    end

    it "returns true for the correct UUID using UUID=" do
      expect(filesystem.match_fstab_spec?("UUID=4d2e6fde-d105-4f15-b8e1-4173badc8c66")).to eq true
      # UUIDs surrounded by quotes are considered also valid
      expect(filesystem.match_fstab_spec?("UUID='4d2e6fde-d105-4f15-b8e1-4173badc8c66'")).to eq true
      expect(filesystem.match_fstab_spec?('UUID="4d2e6fde-d105-4f15-b8e1-4173badc8c66"')).to eq true
    end

    it "returns false for the wrong UUID using UUID=" do
      another_uuid = fake_devicegraph.find_by_name("/dev/sda1").filesystem.uuid
      expect(filesystem.match_fstab_spec?("UUID=#{another_uuid}")).to eq false
    end

    it "returns true for the right UUID udev name" do
      expect(filesystem.match_fstab_spec?("/dev/disk/by-uuid/4d2e6fde-d105-4f15-b8e1-4173badc8c66"))
        .to eq true
    end

    it "returns false for a wrong UUID udev name" do
      another_uuid = fake_devicegraph.find_by_name("/dev/sda1").filesystem.uuid
      expect(filesystem.match_fstab_spec?("/dev/disk/by-uuid/#{another_uuid}")).to eq false
    end

    it "returns true for the right label udev name" do
      expect(filesystem.match_fstab_spec?("/dev/disk/by-label/root")).to eq true
    end

    it "returns false for a wrong label udev name" do
      expect(filesystem.match_fstab_spec?("/dev/disk/by-label/whatever")).to eq false
    end

    it "returns true for any correct udev name" do
      filesystem.blk_devices.first.udev_full_all.each do |name|
        expect(filesystem.match_fstab_spec?(name)).to eq true
      end
    end

    it "returns false for any udev name corresponding to another device" do
      fake_devicegraph.find_by_name("/dev/sda1").udev_full_all.each do |name|
        expect(filesystem.match_fstab_spec?(name)).to eq false
      end
    end

    context "when the device is encrypted" do
      let(:scenario) { "encrypted_partition.xml" }

      let(:dev_name) { "/dev/mapper/cr_sda1" }

      it "returns true for the correct kernel name of the encryption device" do
        expect(filesystem.match_fstab_spec?("/dev/mapper/cr_sda1")).to eq(true)
      end

      it "returns true for any correct udev name of the encryption device" do
        filesystem.blk_devices.first.udev_full_all.each do |name|
          expect(filesystem.match_fstab_spec?(name)).to eq(true)
        end
      end

      it "returns false for the kernel name of the plain device" do
        expect(filesystem.match_fstab_spec?("/dev/sda1")).to eq(false)
      end

      it "returns false for any udev name of the plain device" do
        filesystem.plain_blk_devices.first.udev_full_all.each do |name|
          expect(filesystem.match_fstab_spec?(name)).to eq(false)
        end
      end
    end

    context "when the udev name has to be looked up externally" do
      let(:scenario) { "lvm-disk-as-pv.xml" }
      let(:dev_name) { "/dev/system/boot" }
      let(:dev_name_alternative) { "/dev/mapper/system-boot" }

      before do
        allow(Y2Storage::BlkDevice).to receive(:find_by_any_name)
          .with(fake_devicegraph, dev_name_alternative)
          .and_return(Y2Storage::BlkDevice.find_by_name(fake_devicegraph, dev_name))
      end

      it "returns true if the udev name matches" do
        expect(filesystem.match_fstab_spec?(dev_name_alternative)).to eq true
      end
    end
  end

  describe "#display_name" do
    context "when it is a multi-device filesystem" do
      let(:scenario) { "btrfs2-devicegraph.xml" }

      let(:dev_name) { "/dev/sdb1" }

      it "returns a name representing the filesystem" do
        expect(subject.display_name).to match(/Btrfs over .* devices .*/)
      end
    end

    context "when it is a single-device filesystem" do
      let(:scenario) { "mixed_disks" }

      let(:dev_name) { "/dev/sdb2" }

      it "returns nil" do
        expect(subject.display_name).to be_nil
      end
    end
  end

  describe "#name" do
    let(:scenario) { "mixed_disks" }

    let(:dev_name) { "/dev/sda2" }

    it "returns the name to identify the filesystem" do
      expect(subject.name).to eq("Ext4 sda2")
    end
  end

  describe "#mount_by_name" do
    let(:dev_name) { "/dev/sda2" }
    before { subject.mount_point.mount_by = mount_by }

    context "when mounting by device" do
      let(:mount_by) { Y2Storage::Filesystems::MountByType::DEVICE }

      it "returns the kernel name of the block device" do
        expect(subject.mount_by_name).to eq(dev_name)
      end
    end

    context "when mounting by UUID" do
      let(:mount_by) { Y2Storage::Filesystems::MountByType::UUID }

      context "if the uuid of the filesystem is known already" do
        before { subject.uuid = "111222333444" }

        it "returns the by-uuid udev path" do
          expect(subject.mount_by_name).to eq "/dev/disk/by-uuid/111222333444"
        end
      end

      context "if the uuid is still not known" do
        it "returns nil" do
          expect(subject.mount_by_name).to be_nil
        end
      end
    end

    context "when mounting by label" do
      let(:mount_by) { Y2Storage::Filesystems::MountByType::LABEL }

      context "if the filesystem has a label" do
        it "returns the by-label udev path" do
          expect(subject.mount_by_name).to eq "/dev/disk/by-label/root"
        end
      end

      context "if the filesystem has no label" do
        before { subject.label = "" }

        it "returns nil" do
          expect(subject.mount_by_name).to be_nil
        end
      end
    end

    context "when mounting by path" do
      let(:mount_by) { Y2Storage::Filesystems::MountByType::PATH }

      before do
        allow(subject).to receive(:blk_devices).and_return [blk_device]
        allow(blk_device).to receive(:udev_full_paths).and_return(paths)
      end

      context "if the block device has by-path udev paths" do
        let(:paths) { ["/dev/disk/by-path/pci1111-part2"] }

        it "returns the first by-path udev path" do
          expect(subject.mount_by_name).to eq(paths.first)
        end
      end

      context "if the block device has no by-path udev paths" do
        let(:paths) { [] }

        it "returns nil" do
          expect(subject.mount_by_name).to be_nil
        end
      end
    end

    context "when mounting by id" do
      let(:mount_by) { Y2Storage::Filesystems::MountByType::ID }

      before do
        allow(subject).to receive(:blk_devices).and_return [blk_device]
        allow(blk_device).to receive(:udev_full_ids).and_return(ids)
      end

      context "if the block device has by-id udev paths" do
        let(:ids) { ["/dev/disk/by-id/id:pci:00"] }

        it "returns the first by-id udev path" do
          expect(subject.mount_by_name).to eq(ids.first)
        end
      end

      context "if the block device has no by-id udev paths" do
        let(:ids) { [] }

        it "returns nil" do
          expect(subject.mount_by_name).to be_nil
        end
      end
    end
  end
end
