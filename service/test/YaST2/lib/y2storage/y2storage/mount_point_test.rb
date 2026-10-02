#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2018-2025] SUSE LLC
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

describe Y2Storage::MountPoint do
  include_context "yast2-storage-ng test setup"

  before do
    allow(Y2Storage::VolumeSpecification).to receive(:for).with("/").and_return(root_spec)

    fake_scenario(scenario)
  end

  let(:root_spec) { instance_double(Y2Storage::VolumeSpecification, btrfs_default_subvolume: "@") }

  let(:scenario) { "mixed_disks_btrfs" }

  let(:blk_device) { Y2Storage::BlkDevice.find_by_name(fake_devicegraph, dev_name) }

  subject(:mount_point) { blk_device.blk_filesystem.mount_point }

  let(:dev_name) { "/dev/sda2" }

  describe "#mount_options=" do
    let(:mount_options) { ["rw", "minorversion=1"] }

    it "sets the given mount options" do
      mount_point.mount_options = mount_options
      expect(mount_point.mount_options).to eq(mount_options)
    end

    it "removes previous mount options" do
      mount_point.mount_options = ["ro"]
      expect(mount_point.mount_options).to include("ro")

      mount_point.mount_options = mount_options
      expect(mount_point.mount_options).to_not include("ro")
    end
  end

  describe "#mount_by" do
    context "for non-btrfs" do
      let(:dev_name) { "/dev/sdb5" } # XFS /home
      subject { blk_device.blk_filesystem.mount_point }

      before do
        subject.mount_by = Y2Storage::Filesystems::MountByType::ID
      end

      it "returns the correct mount_by" do
        expect(subject.mount_by.to_sym).to eq :id
      end
    end

    context "for btrfs" do
      let(:dev_name) { "/dev/sda2" } # Btrfs /, mount_by: label
      let(:btrfs) { blk_device.blk_filesystem }

      it "returns the correct mount_by mode" do
        expect(btrfs.mount_point.mount_by.to_sym).to eq :label
      end

      it "subvolumes inherit the mount_by mode from the parent btrfs" do
        # Don't use the first two subvolumes: They don't have a mount point.
        # One is the toplevel subvolume, one is the default subvolume.
        expect(btrfs.btrfs_subvolumes.last.mount_point.mount_by.to_sym).to eq :label
      end
    end
  end

  describe "#ensure_suitable_mount_by with ID as default mount_by" do
    let(:scenario) { "bug_1151075.xml" }
    let(:filesystem) { blk_device.filesystem }
    subject(:mount_point) { filesystem.create_mount_point("/") }

    before do
      conf = Y2Storage::StorageManager.instance.configuration
      conf.default_mount_by = Y2Storage::Filesystems::MountByType::ID
    end

    context "for a partition with udev path and without label" do
      let(:dev_name) { "/dev/nvme1n1p1" }

      it "leaves #mount_by untouched if it was previously set to PATH" do
        mount_point.mount_by = Y2Storage::Filesystems::MountByType::PATH
        mount_point.ensure_suitable_mount_by
        expect(mount_point.mount_by.is?(:path))
      end

      it "sets #mount_by to the default if it was previously set to LABEL" do
        mount_point.mount_by = Y2Storage::Filesystems::MountByType::LABEL
        mount_point.ensure_suitable_mount_by
        expect(mount_point.mount_by.is?(:id))
      end

      it "leaves #mount_by untouched if it was previously set to UUID" do
        mount_point.mount_by = Y2Storage::Filesystems::MountByType::UUID
        mount_point.ensure_suitable_mount_by
        expect(mount_point.mount_by.is?(:uuid))
      end
    end

    context "for a logical volume without label" do
      let(:dev_name) { "/dev/volgroup/lv1" }

      it "sets #mount_by to DEVICE if it was previously set to PATH" do
        mount_point.mount_by = Y2Storage::Filesystems::MountByType::PATH
        mount_point.ensure_suitable_mount_by
        expect(mount_point.mount_by.is?(:device))
      end

      it "sets #mount_by to DEVICE if it was previously set to LABEL" do
        mount_point.mount_by = Y2Storage::Filesystems::MountByType::LABEL
        mount_point.ensure_suitable_mount_by
        expect(mount_point.mount_by.is?(:device))
      end

      it "leaves #mount_by untouched if it was previously set to UUID" do
        mount_point.mount_by = Y2Storage::Filesystems::MountByType::UUID
        mount_point.ensure_suitable_mount_by
        expect(mount_point.mount_by.is?(:uuid))
      end
    end

    context "for an NFS share" do
      let(:blk_device) { nil }
      subject(:filesystem) { fake_devicegraph.nfs_mounts.first }

      it "sets #mount_by to DEVICE if it was previously set to PATH" do
        mount_point.mount_by = Y2Storage::Filesystems::MountByType::PATH
        mount_point.ensure_suitable_mount_by
        expect(mount_point.mount_by.is?(:device))
      end

      it "sets #mount_by to DEVICE if it was previously set to LABEL" do
        mount_point.mount_by = Y2Storage::Filesystems::MountByType::LABEL
        mount_point.ensure_suitable_mount_by
        expect(mount_point.mount_by.is?(:device))
      end

      it "sets #mount_by to DEVICE if it was previously set to LABEL" do
        mount_point.mount_by = Y2Storage::Filesystems::MountByType::UUID
        mount_point.ensure_suitable_mount_by
        expect(mount_point.mount_by.is?(:uuid))
      end
    end
  end

  describe "#suitable_mount_bys" do
    let(:scenario) { "encrypted_partition.xml" }
    let(:filesystem) { blk_device.filesystem }

    context "for a block device with all the udev links" do
      let(:dev_name) { "/dev/sda2" }

      subject(:mount_point) { filesystem.create_mount_point("/") }

      context "if no assumption is done about the label" do
        let(:label) { nil }

        context "and the filesystem has a label" do
          before { filesystem.label = "something" }

          it "returns all the existing types" do
            expect(mount_point.suitable_mount_bys(label: label))
              .to contain_exactly(*Y2Storage::Filesystems::MountByType.all)
          end
        end

        context "and the filesystem has no label" do
          it "returns all the existing types except LABEL" do
            types = Y2Storage::Filesystems::MountByType.all.reject { |t| t.is?(:label) }
            expect(mount_point.suitable_mount_bys(label: label)).to contain_exactly(*types)
          end
        end
      end

      context "if we take a label for granted" do
        let(:label) { true }

        context "and the filesystem has a label" do
          before { filesystem.label = "something" }

          it "returns all the existing types" do
            expect(mount_point.suitable_mount_bys(label: label))
              .to contain_exactly(*Y2Storage::Filesystems::MountByType.all)
          end
        end

        context "and the filesystem has no label" do
          it "returns all the existing types" do
            expect(mount_point.suitable_mount_bys(label: label))
              .to contain_exactly(*Y2Storage::Filesystems::MountByType.all)
          end
        end
      end

      context "if no assumption is not done regarding encryption" do
        let(:encryption) { nil }

        it "includes ID or PATH if the corresponding udev links are available" do
          types = mount_point.suitable_mount_bys(encryption: encryption)
          expect(types).to include(Y2Storage::Filesystems::MountByType::ID)
          expect(types).to include(Y2Storage::Filesystems::MountByType::PATH)
        end
      end

      context "if we assume the device is going to be encrypted" do
        let(:encryption) { true }

        it "does not include ID or PATH" do
          types = mount_point.suitable_mount_bys(encryption: encryption)
          expect(types).to_not include(Y2Storage::Filesystems::MountByType::ID)
          expect(types).to_not include(Y2Storage::Filesystems::MountByType::PATH)
        end
      end

      context "if we take the UUID for granted" do
        let(:assume_uuid) { true }

        context "and the UUID is already known" do
          before { filesystem.uuid = "12345678-90ab-cdef-1234-567890abcdef" }

          it "includes MountByType::UUID" do
            expect(mount_point.suitable_mount_bys(assume_uuid: assume_uuid))
              .to include(Y2Storage::Filesystems::MountByType::UUID)
          end
        end

        context "and the filesystem has no UUID in the devicegraph" do
          before { filesystem.uuid = "" }

          it "includes MountByType::UUID" do
            expect(mount_point.suitable_mount_bys(assume_uuid: assume_uuid))
              .to include(Y2Storage::Filesystems::MountByType::UUID)
          end
        end
      end

      context "if we do not take the UUID for granted" do
        let(:assume_uuid) { false }

        context "and the UUID is already known" do
          before { filesystem.uuid = "12345678-90ab-cdef-1234-567890abcdef" }

          it "includes MountByType::UUID" do
            expect(mount_point.suitable_mount_bys(assume_uuid: assume_uuid))
              .to include(Y2Storage::Filesystems::MountByType::UUID)
          end
        end

        context "and the filesystem has no UUID in the devicegraph" do
          before { filesystem.uuid = "" }

          it "does not include MountByType::UUID" do
            expect(mount_point.suitable_mount_bys(assume_uuid: assume_uuid))
              .to_not include(Y2Storage::Filesystems::MountByType::UUID)
          end
        end
      end
    end

    context "for an encrypted device" do
      let(:dev_name) { "/dev/mapper/cr_sda1" }

      subject(:mount_point) { filesystem.create_mount_point("/") }

      context "if no assumption is done about the label" do
        let(:label) { nil }

        context "and the filesystem has a label" do
          before { filesystem.label = "something" }

          it "returns all the existing types except the ones associated to udev links" do
            types = Y2Storage::Filesystems::MountByType.all.reject { |t| t.is?(:id, :path) }
            expect(mount_point.suitable_mount_bys(label: label)).to contain_exactly(*types)
          end
        end

        context "and the filesystem has no label" do
          it "returns only DEVICE and UUID" do
            expect(mount_point.suitable_mount_bys(label: label)).to contain_exactly(
              Y2Storage::Filesystems::MountByType::DEVICE, Y2Storage::Filesystems::MountByType::UUID
            )
          end
        end
      end

      context "if we take a label for granted" do
        let(:label) { true }

        context "and the filesystem has a label" do
          before { filesystem.label = "something" }

          it "returns all the existing types except the ones associated to udev links" do
            types = Y2Storage::Filesystems::MountByType.all.reject { |t| t.is?(:id, :path) }
            expect(mount_point.suitable_mount_bys(label: label)).to contain_exactly(*types)
          end
        end

        context "although the filesystem has no label" do
          it "returns all the existing types except the ones associated to udev links" do
            types = Y2Storage::Filesystems::MountByType.all.reject { |t| t.is?(:id, :path) }
            expect(mount_point.suitable_mount_bys(label: label)).to contain_exactly(*types)
          end
        end
      end

      context "if we assume the encryption is going to be removed" do
        let(:encryption) { false }

        context "and the filesystem has a label" do
          before { filesystem.label = "something" }

          it "returns all the existing types" do
            expect(mount_point.suitable_mount_bys(encryption: encryption))
              .to contain_exactly(*Y2Storage::Filesystems::MountByType.all)
          end
        end

        context "and the filesystem has no label" do
          it "returns all the existing types except LABEL" do
            types = Y2Storage::Filesystems::MountByType.all.reject { |t| t.is?(:label) }
            expect(mount_point.suitable_mount_bys(encryption: encryption))
              .to contain_exactly(*types)
          end
        end
      end
    end

    context "for a device encrypted with volatile encryption" do
      let(:dev_name) { "/dev/sda2" }

      before do
        blk_device.remove_descendants
        enc = blk_device.encrypt(method: Y2Storage::EncryptionMethod::RANDOM_SWAP)
        filesystem = enc.create_filesystem(Y2Storage::Filesystems::Type::SWAP)
        filesystem.label = "something"
      end

      subject(:mount_point) { filesystem.create_mount_point("swap") }

      it "returns an array containing only DEVICE" do
        expect(mount_point.suitable_mount_bys).to eq [Y2Storage::Filesystems::MountByType::DEVICE]
      end
    end
  end

  describe "#passno" do
    let(:scenario) { "empty_hard_disk_50GiB" }

    let(:dev_name) { "/dev/sda" }
    let(:filesystem) { blk_device.create_filesystem(fs_type) }
    subject(:mount_point) { filesystem.create_mount_point(path) }

    context "for an ext4 filesystem" do
      let(:fs_type) { Y2Storage::Filesystems::Type::EXT4 }

      context "mounted at /" do
        let(:path) { "/" }

        it "is set to 1" do
          expect(mount_point.passno).to eq 1
        end

        context "and later reassigned to another path" do
          it "is set to 2" do
            mount_point.path = "/var"
            expect(mount_point.passno).to eq 2
          end
        end
      end

      context "mounted at a non-root location" do
        let(:path) { "/home" }

        it "is set to 2" do
          expect(mount_point.passno).to eq 2
        end
      end
    end

    context "for an xfs filesystem" do
      let(:fs_type) { Y2Storage::Filesystems::Type::XFS }

      context "mounted at /" do
        let(:path) { "/" }

        it "is set to 0" do
          expect(mount_point.passno).to eq 0
        end
      end

      context "mounted at a non-root location" do
        let(:path) { "/home" }

        it "is set to 0" do
          expect(mount_point.passno).to eq 0
        end
      end
    end

    context "for an BTRFS filesystem" do
      let(:fs_type) { Y2Storage::Filesystems::Type::BTRFS }
      let(:specs) do
        [Y2Storage::SubvolSpecification.new("foo"), Y2Storage::SubvolSpecification.new("bar")]
      end

      let(:path) { "/" }

      it "is set to 0 for the filesystem and all its subvolumes" do
        expect(mount_point.passno).to eq 0

        filesystem.add_btrfs_subvolumes(specs)
        mount_points = filesystem.btrfs_subvolumes.map(&:mount_point).compact
        expect(mount_points.any?).to eq(true)
        expect(mount_points.map(&:passno)).to all(eq(0))
      end
    end

    context "for an NFS filesystem" do
      let(:filesystem) { Y2Storage::Filesystems::Nfs.create(fake_devicegraph, "server", path) }

      context "mounted at /" do
        let(:path) { "/" }

        it "is set to 0" do
          expect(mount_point.passno).to eq 0
        end
      end

      context "mounted at a non-root location" do
        let(:path) { "/home" }

        it "is set to 0" do
          expect(mount_point.passno).to eq 0
        end
      end
    end

    context "for a VFAT filesystem" do
      let(:fs_type) { Y2Storage::Filesystems::Type::VFAT }

      context "mounted at /" do
        let(:path) { "/" }

        it "is set to 0" do
          expect(mount_point.passno).to eq 0
        end

        context "and later reassigned to another path" do
          it "is set to 0" do
            mount_point.path = "/var"
            expect(mount_point.passno).to eq 0
          end
        end

        context "and later reassigned to /boot/efi" do
          it "is set to 2" do
            mount_point.path = "/boot/efi"
            expect(mount_point.passno).to eq 2
          end
        end
      end

      context "mounted at a non-root location" do
        let(:path) { "/home" }

        it "is set to 0" do
          expect(mount_point.passno).to eq 0
        end
      end

      context "mounted at /boot/efi" do
        let(:path) { "/boot/efi" }

        it "is set to 2" do
          expect(mount_point.passno).to eq 2
        end
      end
    end
  end

  describe "#set_default_mount_options" do
    subject(:mount_point) { mountable.mount_point }

    context "in an NFS filesystem" do
      let(:mountable) { Y2Storage::Filesystems::Nfs.create(fake_devicegraph, "server", "path") }
      before { mountable.create_mount_point("/mnt") }

      it "sets #mount_options to an empty array" do
        mount_point.set_default_mount_options
        expect(mount_point.mount_options).to be_empty
      end
    end

    context "in a disk" do
      let(:blk_device) { Y2Storage::BlkDevice.find_by_name(fake_devicegraph, dev_name) }
      let(:mountable) { blk_device.filesystem }

      context "for the root filesystem" do
        before do
          mount_point.path = "/"
        end

        context "for a Btrfs file-system (the same applies to most file-system types)" do
          let(:dev_name) { "/dev/sda2" }

          it "sets #mount_options to an empty array" do
            mount_point.set_default_mount_options
            expect(mount_point.mount_options).to eq []
          end
        end

        context "for a Btrfs subvolume" do
          let(:dev_name) { "/dev/sda2" }
          let(:mountable) { blk_device.filesystem.btrfs_subvolumes.last }

          it "sets #mount_options to an array containing only the subvol option" do
            mount_point.set_default_mount_options
            options = mount_point.mount_options
            expect(options.size).to eq 1
            expect(options.first).to match(/^subvol=/)
          end
        end

        context "for an Ext3 or Ext4 file-system" do
          let(:dev_name) { "/dev/sda3" }

          it "sets #mount_options to an empty array" do
            mount_point.set_default_mount_options
            expect(mount_point.mount_options).to eq []
          end
        end
      end

      context "for a non-root filesystem" do
        before do
          mount_point.path = "/home"
        end

        context "for a Btrfs file-system (the same applies to most file-system types)" do
          let(:dev_name) { "/dev/sda2" }

          it "sets #mount_options to an empty array" do
            mount_point.set_default_mount_options
            expect(mount_point.mount_options).to eq []
          end
        end

        context "for a Btrfs subvolume" do
          let(:dev_name) { "/dev/sda2" }
          let(:mountable) { blk_device.filesystem.btrfs_subvolumes.last }

          it "sets #mount_options to an array containing only the subvol option" do
            mount_point.set_default_mount_options
            options = mount_point.mount_options
            expect(options.size).to eq 1
            expect(options.first).to match(/^subvol=/)
          end
        end

        context "for an Ext3 or Ext4 file-system" do
          let(:dev_name) { "/dev/sda3" }

          it "sets #mount_options to an array containing only the data option" do
            mount_point.set_default_mount_options
            expect(mount_point.mount_options).to eq ["data=ordered"]
          end
        end
      end
    end
  end

  describe "#adjust_mount_options" do
    subject(:mount_point) { mountable.mount_point }

    RSpec.shared_examples "remove netdev" do
      it "removes the _netdev option if it is there" do
        mount_point.mount_options = ["one", "_netdev", "two"]
        mount_point.adjust_mount_options
        expect(mount_point.mount_options).to eq ["one", "two"]
      end
    end

    RSpec.shared_examples "add netdev" do
      it "adds the _netdev option if it is not there" do
        mount_point.mount_options = ["one", "two"]
        mount_point.adjust_mount_options
        expect(mount_point.mount_options).to eq ["one", "two", "_netdev"]
      end
    end

    context "in an NFS filesystem" do
      let(:mountable) { Y2Storage::Filesystems::Nfs.create(fake_devicegraph, "server", "path") }
      before { mountable.create_mount_point("/mnt") }

      it "does not change #mount_options" do
        mount_point.mount_options = ["one", "_netdev", "two"]
        mount_point.adjust_mount_options
        expect(mount_point.mount_options).to eq ["one", "_netdev", "two"]
      end
    end

    context "for a filesystem directly on a local disk (i.e. BlkDevice#in_network? returns " \
            "false)" do
      let(:scenario) { "empty_hard_disk_50GiB" }
      let(:dev_name) { "/dev/sda" }
      let(:mountable) { blk_device.create_filesystem(Y2Storage::Filesystems::Type::XFS) }
      subject(:mount_point) { mountable.create_mount_point("/home") }

      include_examples "remove netdev"
    end

    context "for a filesystem on a Xen virtual partition" do
      let(:scenario) { "xen-partitions.xml" }
      let(:dev_name) { "/dev/xvda1" }
      let(:mountable) { blk_device.create_filesystem(Y2Storage::Filesystems::Type::XFS) }
      subject(:mount_point) { mountable.create_mount_point("/home") }

      include_examples "remove netdev"
    end

    context "for a partition in a local disk (i.e. BlkDevice#in_network? returns false)" do
      let(:mountable) { blk_device.filesystem }

      include_examples "remove netdev"
    end

    context "for a filesystem directly on a network disk (i.e. BlkDevice#in_network? returns " \
            "true)" do
      let(:scenario) { "empty_hard_disk_50GiB" }
      let(:dev_name) { "/dev/sda" }
      let(:mountable) { blk_device.create_filesystem(Y2Storage::Filesystems::Type::XFS) }

      before do
        allow(blk_device.transport).to receive(:network?).and_return true
        allow_any_instance_of(Y2Storage::Disk).to receive(:hwinfo).and_return(hwinfo)
      end

      subject(:mount_point) { mountable.create_mount_point(path) }

      context "if the disk uses a driver that depends on a systemd service" do
        let(:hwinfo) { Y2Storage::HWInfoDisk.new(driver: ["iscsi_tcp", "iscsi"]) }

        context "and the filesystem is mounted at /" do
          let(:path) { "/" }

          include_examples "remove netdev"
        end

        context "and the filesystem is mounted at /var" do
          let(:path) { "/var" }

          include_examples "remove netdev"
        end

        context "and the filesystem is mounted at a regular path (not / or /var)" do
          let(:path) { "/opt" }

          include_examples "add netdev"
        end
      end

      context "if the disk driver does not depend on any systemd service" do
        let(:hwinfo) { Y2Storage::HWInfoDisk.new }
        context "and the filesystem is mounted at /" do
          let(:path) { "/" }

          include_examples "remove netdev"
        end

        context "and the filesystem is mounted at /var" do
          let(:path) { "/var" }

          include_examples "remove netdev"
        end

        context "and the filesystem is mounted at a regular path (not / or /var)" do
          let(:path) { "/opt" }

          include_examples "remove netdev"
        end
      end
    end

    context "for a partition in a network disk (i.e. BlkDevice#in_network? returns true)" do
      let(:mountable) { blk_device.filesystem }
      let(:hwinfo) { Y2Storage::HWInfoDisk.new }

      before do
        disk = Y2Storage::BlkDevice.find_by_name(fake_devicegraph, "/dev/sda")
        allow(disk.transport).to receive(:network?).and_return true

        allow_any_instance_of(Y2Storage::Disk).to receive(:hwinfo).and_return(hwinfo)
      end

      context "if the disk uses a driver that depends on a systemd service" do
        let(:hwinfo) { Y2Storage::HWInfoDisk.new(driver: ["fcoe"]) }

        context "and the filesystem is mounted at /" do
          before { mount_point.path = "/" }

          include_examples "remove netdev"
        end

        context "and the filesystem is mounted at /var" do
          before { mount_point.path = "/var" }

          include_examples "remove netdev"
        end

        context "and the filesystem is mounted at a regular path (not / or /var)" do
          before { mount_point.path = "/home" }

          let(:disk_partitions) { blk_device.disk.partitions }

          before do
            disk_partitions.each do |part|
              next if part.filesystem&.mount_point.nil?
              next if part == blk_device

              part.filesystem.mount_path = alt_mount_path
            end
          end

          context "if the disk contains (directly or indirectly) the root filesystem" do
            let(:alt_mount_path) { "/" }

            include_examples "remove netdev"
          end

          context "if the disk contains (directly or indirectly) the /var filesystem" do
            let(:alt_mount_path) { "/var" }

            include_examples "remove netdev"
          end

          context "if the disk does not contain /var or /" do
            let(:alt_mount_path) { "/opt" }

            include_examples "add netdev"
          end
        end
      end

      context "if the disk driver does not depend on any systemd service" do
        context "and the filesystem is mounted at /" do
          before { mount_point.path = "/" }

          include_examples "remove netdev"
        end

        context "and the filesystem is mounted at /var" do
          before { mount_point.path = "/var" }

          include_examples "remove netdev"
        end

        context "and the filesystem is mounted at a regular path (not / or /var)" do
          before { mount_point.path = "/home" }

          include_examples "remove netdev"
        end
      end
    end
  end
end
