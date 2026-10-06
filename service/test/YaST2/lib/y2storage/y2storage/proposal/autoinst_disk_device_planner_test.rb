#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2018] SUSE LLC
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

require_relative "../../support/autoinst_devices_planner_btrfs"
require_relative "../../support/autoinst_devices_planner_bcache"
require_relative "../../support/autoinst_devices_planner_conflicts"
require "y2storage/proposal/autoinst_disk_device_planner"
Yast.import "Arch"

describe Y2Storage::Proposal::AutoinstDiskDevicePlanner do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject(:planner) { described_class.new(fake_devicegraph, issues_list) }

  let(:scenario) { "windows-linux-free-pc" }
  let(:issues_list) { ::Installation::AutoinstIssues::List.new }

  before do
    fake_scenario(scenario)
    Y2Storage::VolumeSpecification.clear_cache
  end

  describe "#planned_devices" do
    let(:drive) { Y2Storage::AutoinstProfile::DriveSection.new_from_hashes(disk_spec) }

    let(:disk_spec) do
      { "device" => "/dev/sda", "partitions" => [root_spec] }
    end

    let(:root_spec) do
      { "mount" => "/", "filesystem" => "btrfs", "fstopt" => "ro,acl", "mkfs_options" => "-b 2048" }
    end

    include_examples "handles bcache configuration"

    include_examples "handles conflicts"

    context "specifying partition type" do
      context "when partition_type is set to 'primary'" do
        let(:root_spec) { { "mount" => "/", "size" => "max", "partition_type" => "primary" } }

        it "sets the planned device as 'primary'" do
          disk = planner.planned_devices(drive).first
          root = disk.partitions.find { |d| d.mount_point == "/" }
          expect(root.primary).to eq(true)
        end
      end

      context "when partition_type is set to other value" do
        let(:root_spec) { { "mount" => "/", "size" => "max", "partition_type" => "logical" } }

        it "sets planned device as not 'primary'" do
          disk = planner.planned_devices(drive).first
          root = disk.partitions.find { |d| d.mount_point == "/" }
          expect(root.primary).to eq(false)
        end
      end

      context "when partition_type is not set" do
        let(:root_spec) { { "mount" => "/", "size" => "max" } }

        it "does not set 'primary'" do
          disk = planner.planned_devices(drive).first
          root = disk.partitions.find { |d| d.mount_point == "/" }
          expect(root.primary).to eq(false)
        end
      end
    end

    context "specifying the uuid" do
      let(:scenario) { "autoyast_drive_examples" }

      let(:disk_spec) do
        { "device" => "/dev/sdc", "partitions" => [root_spec] }
      end

      let(:root_spec) do
        { "mount" => "/", "filesystem" => "btrfs", "uuid" => "root-uuid" }
      end

      it "ignores it" do
        disk = planner.planned_devices(drive).first
        root = disk.partitions.find { |d| d.mount_point == "/" }

        expect(root.uuid).to be_nil
      end
    end

    context "specifying size" do
      using Y2Storage::Refinements::SizeCasts

      let(:root_spec) do
        { "mount" => "/", "filesystem" => "btrfs", "size" => size }
      end

      context "when only a number is given" do
        let(:disk_size) { Y2Storage::DiskSize.B(10) }
        let(:size) { "10" }

        it "sets the size according to that number and using unit B" do
          disk = planner.planned_devices(drive).first
          root = disk.partitions.find { |d| d.mount_point == "/" }
          expect(root.min_size).to eq(disk_size)
          expect(root.max_size).to eq(disk_size)
        end
      end

      context "when a number+unit is given" do
        let(:disk_size) { 5.GiB }
        let(:size) { "5GB" }

        it "sets the size according to that number and using legacy_units" do
          disk = planner.planned_devices(drive).first
          root = disk.partitions.find { |d| d.mount_point == "/" }
          expect(root.min_size).to eq(disk_size)
          expect(root.max_size).to eq(disk_size)
        end
      end

      context "when a percentage is given" do
        let(:disk_size) { 250.GiB }
        let(:size) { "50%" }

        it "sets the size as a percentage" do
          disk = planner.planned_devices(drive).first
          root = disk.partitions.find { |d| d.mount_point == "/" }
          expect(root.percent_size).to eq(50)
        end
      end

      context "when 'max' is given" do
        let(:size) { "max" }

        it "sets the size to 'unlimited'" do
          disk = planner.planned_devices(drive).first
          root = disk.partitions.find { |d| d.mount_point == "/" }
          expect(root.min_size).to eq(Y2Storage::DiskSize.B(1))
          expect(root.max_size).to eq(Y2Storage::DiskSize.unlimited)
        end

        it "sets the weight to '1'" do
          disk = planner.planned_devices(drive).first
          root = disk.partitions.find { |d| d.mount_point == "/" }
          expect(root.weight).to eq(1)
        end
      end

      context "when an invalid value is given" do
        let(:size) { "huh?" }

        it "registers an issue" do
          expect(issues_list).to be_empty
          planner.planned_devices(drive)
          issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::InvalidValue) }
          expect(issue.value).to eq("huh?")
          expect(issue.attr).to eq(:size)
          expect(issue.new_value).to eq(:skip)
        end
      end

      context "when 'auto' is given" do
        let(:size) { "max" } # FIXME: root_size

        let(:auto_spec) do
          { "mount" => "swap", "filesystem" => "swap", "size" => "auto" }
        end

        let(:disk_spec) do
          { "device" => "/dev/sda", "partitions" => [root_spec, auto_spec] }
        end

        let(:settings) do
          instance_double(Y2Storage::ProposalSettings, volumes: volumes, format: :ng)
        end

        let(:volumes) { [] }

        before do
          allow(Y2Storage::ProposalSettings).to receive(:new_for_current_product)
            .and_return(settings)
        end

        context "when min and max are defined in the control file" do
          let(:volumes) do
            [
              Y2Storage::VolumeSpecification.new(
                "mount_point" => "swap", "min_size" => "128MiB", "max_size" => "1GiB"
              )
            ]
          end

          it "sets min and max" do
            disk = planner.planned_devices(drive).first
            swap = disk.partitions.find { |d| d.mount_point == "swap" }
            expect(swap.min_size).to eq(128.MiB)
            expect(swap.max_size).to eq(1.GiB)
          end
        end

        context "when no default values are defined in the control file" do
          let(:auto_spec) do
            { "mount" => "/home", "filesystem" => "btrfs", "size" => "auto" }
          end

          it "ignores the device" do
            disk = planner.planned_devices(drive).first
            home = disk.partitions.find { |d| d.mount_point == "/home" }
            expect(home).to be_nil
          end

          it "registers an issue" do
            expect(issues_list).to be_empty
            planner.planned_devices(drive)
            issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::InvalidValue) }
            expect(issue.value).to eq("auto")
            expect(issue.attr).to eq(:size)
          end

          context "and device will be used as swap" do
            let(:auto_spec) do
              { "mount" => "swap", "filesystem" => "swap", "size" => "auto" }
            end

            it "sets default values" do
              disk = planner.planned_devices(drive).first
              swap = disk.partitions.find { |d| d.mount_point == "swap" }
              expect(swap.min_size).to eq(512.MiB)
              expect(swap.max_size).to eq(2.GiB)
            end
          end
        end
      end

      context "when empty entry is given" do
        let(:size) { "" }

        it "sets the size to 'unlimited'" do
          disk = planner.planned_devices(drive).first
          root = disk.partitions.find { |d| d.mount_point == "/" }
          expect(root.min_size).to eq(Y2Storage::DiskSize.B(1))
          expect(root.max_size).to eq(Y2Storage::DiskSize.unlimited)
        end
      end
    end

    context "specifying filesystem options" do
      let(:disk_spec) do
        { "device" => "/dev/sda", "use" => "all",
          "partitions" => [root_spec, home_spec, swap_spec] }
      end

      let(:home_spec) do
        { "mount" => "/home", "filesystem" => "xfs", "mountby" => :uuid }
      end

      let(:swap_spec) do
        { "mount" => "swap" }
      end

      it "sets the filesystem" do
        disk = planner.planned_devices(drive).first
        root = disk.partitions.find { |d| d.mount_point == "/" }
        home = disk.partitions.find { |d| d.mount_point == "/home" }
        expect(root.filesystem_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
        expect(home.filesystem_type).to eq(Y2Storage::Filesystems::Type::XFS)
      end

      context "when filesystem type is not specified" do
        let(:volspec_builder) do
          instance_double(Y2Storage::VolumeSpecificationBuilder, for: volspec)
        end
        let(:home_spec) { { "mount" => "/srv" } }
        let(:volspec) { Y2Storage::VolumeSpecification.new("fs_type" => "btrfs") }

        before do
          allow(Y2Storage::VolumeSpecificationBuilder).to receive(:new)
            .and_return(volspec_builder)
        end

        it "sets to the default type for the given mount point" do
          expect(volspec_builder).to receive(:for).with("/srv").and_return(volspec)
          disk = planner.planned_devices(drive).first
          srv = disk.partitions.find { |d| d.mount_point == "/srv" }
          expect(srv.filesystem_type).to eq(volspec.fs_type)
        end

        context "and no default is defined" do
          let(:volspec) { Y2Storage::VolumeSpecification.new({}) }

          it "sets filesystem to btrfs" do
            disk = planner.planned_devices(drive).first
            srv = disk.partitions.find { |d| d.mount_point == "/srv" }
            expect(srv.filesystem_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
          end

          context "and is a swap filesystem" do
            it "sets filesystem to swap" do
              disk = planner.planned_devices(drive).first
              swap = disk.partitions.find { |d| d.mount_point == "swap" }
              expect(swap.filesystem_type).to eq(Y2Storage::Filesystems::Type::SWAP)
            end
          end
        end
      end

      it "sets the mountby properties" do
        disk = planner.planned_devices(drive).first
        root = disk.partitions.find { |d| d.mount_point == "/" }
        home = disk.partitions.find { |d| d.mount_point == "/home" }
        expect(root.mount_by).to be_nil
        expect(home.mount_by).to eq(Y2Storage::Filesystems::MountByType::UUID)
      end

      it "sets fstab options" do
        disk = planner.planned_devices(drive).first
        root = disk.partitions.find { |d| d.mount_point == "/" }
        expect(root.fstab_options).to eq(["ro", "acl"])
      end

      it "sets mkfs options" do
        disk = planner.planned_devices(drive).first
        root = disk.partitions.find { |d| d.mount_point == "/" }
        expect(root.mkfs_options).to eq("-b 2048")
      end
    end

    context "specifying crypted partitions" do
      let(:root_spec) do
        { "mount" => "/", "filesystem" => "btrfs", "crypt_fs" => true, "crypt_key" => "secret" }
      end
      let(:encryption_method) { Y2Storage::EncryptionMethod::PERVASIVE_LUKS2 }
      let(:available?) { true }

      before do
        allow(encryption_method).to receive(:available?).and_return(available?) if encryption_method
      end

      it "sets the encryption password" do
        disk = planner.planned_devices(drive).first
        root = disk.partitions.find { |d| d.mount_point == "/" }
        expect(root.encryption_password).to eq("secret")
      end

      it "sets the encryption method to 'luks1'" do
        disk = planner.planned_devices(drive).first
        root = disk.partitions.find { |d| d.mount_point == "/" }
        expect(root.encryption_method).to eq(Y2Storage::EncryptionMethod::LUKS1)
      end

      context "when a encryption method is specified" do
        let(:root_spec) do
          { "mount" => "/", "filesystem" => "btrfs", "crypt_method" => crypt_method }
        end
        let(:crypt_method) { :pervasive_luks2 }
        let(:encryption_method) { Y2Storage::EncryptionMethod::PERVASIVE_LUKS2 }

        it "sets the method to the given one" do
          disk = planner.planned_devices(drive).first
          root = disk.partitions.find { |d| d.mount_point == "/" }
          expect(root.encryption_method).to eq(encryption_method)
        end

        context "and the method is not available" do
          let(:available?) { false }

          it "does not set encryption method or password" do
            disk = planner.planned_devices(drive).first
            root = disk.partitions.find { |d| d.mount_point == "/" }
            expect(root.encryption_method).to be_nil
            expect(root.encryption_password).to be_nil
          end

          it "registers an issue" do
            planner.planned_devices(drive)
            issue = subject.issues_list.find do |i|
              i.is_a?(Y2Storage::AutoinstIssues::InvalidEncryption)
            end
            expect(issue.reason).to eq(:unavailable)
          end
        end

        context "and the method is unknown" do
          let(:crypt_method) { :foo }

          it "does not set encryption method or password" do
            disk = planner.planned_devices(drive).first
            root = disk.partitions.find { |d| d.mount_point == "/" }
            expect(root.encryption_method).to be_nil
            expect(root.encryption_password).to be_nil
          end

          it "registers an issue" do
            planner.planned_devices(drive)
            issue = subject.issues_list.find do |i|
              i.is_a?(Y2Storage::AutoinstIssues::InvalidEncryption)
            end
            expect(issue.reason).to eq(:unknown)
          end
        end

        context "when the device is not suitable for the given encryption" do
          let(:crypt_method) { :random_swap }

          it "does not set encryption method or password" do
            disk = planner.planned_devices(drive).first
            root = disk.partitions.find { |d| d.mount_point == "/" }
            expect(root.encryption_method).to be_nil
            expect(root.encryption_password).to be_nil
          end

          it "registers an issue" do
            planner.planned_devices(drive)
            issue = subject.issues_list.find do |i|
              i.is_a?(Y2Storage::AutoinstIssues::InvalidEncryption)
            end
            expect(issue.reason).to eq(:unsuitable)
          end
        end
      end
    end

    context "reusing partitions" do
      context "when a partition number is specified" do
        let(:scenario) { "autoyast_drive_examples" }

        let(:disk_spec) do
          { "device" => "/dev/sdb", "partitions" => [root_spec] }
        end

        let(:root_spec) do
          { "create" => false, "mount" => "/", "filesystem" => "btrfs", "partition_nr" => 2 }
        end

        it "reuses the partition with that number" do
          disk = planner.planned_devices(drive).first
          root = disk.partitions.find { |d| d.mount_point == "/" }
          expect(root.reuse_name).to eq("/dev/sdb2")
        end
      end

      context "when a partition label is specified" do
        let(:root_spec) do
          { "create" => false, "mount" => "/", "filesystem" => :btrfs, "label" => "root" }
        end

        it "reuses the partition with that label" do
          disk = planner.planned_devices(drive).first
          root = disk.partitions.find { |d| d.mount_point == "/" }
          expect(root.reuse_name).to eq("/dev/sda3")
        end
      end

      context "when an uuid is specified" do
        let(:scenario) { "autoyast_drive_examples" }

        let(:disk_spec) do
          { "device" => "/dev/sdc", "partitions" => [root_spec] }
        end

        let(:root_spec) do
          { "create" => false, "uuid" => "root-uuid" }
        end

        it "reuses the partition with that uuid" do
          disk = planner.planned_devices(drive).first
          root = disk.partitions.find { |d| d.uuid == "root-uuid" }

          expect(root.reuse_name).to eq("/dev/sdc3")
        end
      end

      context "when the partition to reuse does not exist" do
        let(:root_spec) do
          { "create" => false, "mount" => "/", "filesystem" => :btrfs, "partition_nr" => 99 }
        end

        it "adds a new partition" do
          disk = planner.planned_devices(drive).first
          root = disk.partitions.find { |d| d.mount_point == "/" }
          expect(root.reuse_name).to be_nil
        end

        it "registers an issue" do
          expect(issues_list).to be_empty
          planner.planned_devices(drive)
          issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::MissingReusableDevice) }
          expect(issue).to_not be_nil
        end
      end

      # Regression test for bsc#1134330: when a bios_boot partition (which
      # contains no filesystem by definition) is specified to be reused, a bogus
      # MissingReusableFilesystem issue is registered
      context "when the partition is not formatted and should be reused as-is" do
        let(:scenario) { "autoyast_drive_examples" }

        let(:disk_spec) do
          { "device" => "/dev/sdh", "partitions" => [grub_spec] }
        end

        let(:grub_spec) do
          { "create" => false, "format" => false, "partition_nr" => 2 }
        end

        it "reuses the partition" do
          disk = planner.planned_devices(drive).first
          grub = disk.partitions.first
          expect(grub.reuse_name).to eq("/dev/sdh2")
        end

        it "does not register any issue" do
          expect(issues_list).to be_empty
          planner.planned_devices(drive)
          expect(issues_list).to be_empty
        end
      end

      context "when no partition number or label is specified" do
        let(:root_spec) do
          { "create" => false, "mount" => "/", "filesystem" => :btrfs }
        end

        it "adds a new partition" do
          disk = planner.planned_devices(drive).first
          root = disk.partitions.find { |d| d.mount_point == "/" }
          expect(root.reuse_name).to be_nil
        end

        it "registers an issue" do
          expect(issues_list).to be_empty
          planner.planned_devices(drive)
          issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::MissingReuseInfo) }
          expect(issue).to_not be_nil
        end

        context "when formating but not mounting a partition" do
          let(:root_spec) do
            { "create" => false, "format" => true, "filesystem" => fs, "partition_nr" => 3 }
          end

          context "if the file system type is specified" do
            let(:fs) { "xfs" }

            it "plans the specified filesystem type" do
              disk = planner.planned_devices(drive).first
              planned = disk.partitions.find { |d| d.reuse_name == "/dev/sda3" }
              expect(planned.reformat?).to eq true
              expect(planned.filesystem_type).to eq Y2Storage::Filesystems::Type::XFS
            end
          end

          context "if the file system type is not specified" do
            let(:fs) { nil }

            it "keeps the previous file system type of the partition" do
              disk = planner.planned_devices(drive).first
              planned = disk.partitions.find { |d| d.reuse_name == "/dev/sda3" }
              expect(planned.reformat?).to eq true
              expect(planned.filesystem_type).to eq Y2Storage::Filesystems::Type::EXT4
            end
          end
        end
      end

      context "when trying to reuse a filesystem which does not exist" do
        let(:root_spec) do
          { "create" => false, "format" => false, "partition_nr" => 3, "mount" => "/" }
        end

        before do
          sda3 = Y2Storage::BlkDevice.find_by_name(fake_devicegraph, "/dev/sda3")
          sda3.remove_descendants
        end

        it "registers an issue" do
          expect(issues_list).to be_empty
          planner.planned_devices(drive)
          issue = issues_list.find do |i|
            i.is_a?(Y2Storage::AutoinstIssues::MissingReusableFilesystem)
          end
          expect(issue).to_not be_nil
        end
      end
    end

    context "when formatting but not mounting a Xen virtual partitions" do
      let(:scenario) { "xen-partitions.xml" }

      let(:disk_spec) do
        { "device" => "/dev/xvda", "use" => "all", "partitions" => part_section }
      end

      context "if the file system type is specified" do
        let(:part_section) { [{ "partition_nr" => 2, "format" => true, "filesystem" => "ext2" }] }

        it "plans the specified filesystem type" do
          devices = planner.planned_devices(drive)
          planned = devices.find { |d| d.reuse_name == "/dev/xvda2" }
          expect(planned.reformat?).to eq true
          expect(planned.filesystem_type).to eq Y2Storage::Filesystems::Type::EXT2
        end
      end

      context "if the file system type is not specified and there is a previous file system" do
        let(:part_section) { [{ "partition_nr" => 2, "format" => true }] }

        it "reuses the previous file system type" do
          devices = planner.planned_devices(drive)
          planned = devices.find { |d| d.reuse_name == "/dev/xvda2" }
          expect(planned.reformat?).to eq true
          expect(planned.filesystem_type).to eq Y2Storage::Filesystems::Type::XFS
        end
      end

      context "if the file system type is not specified and there is no previous file system" do
        let(:part_section) { [{ "partition_nr" => 1, "format" => true }] }

        it "plans no filesystem type" do
          devices = planner.planned_devices(drive)
          planned = devices.find { |d| d.reuse_name == "/dev/xvda1" }
          expect(planned.reformat?).to eq true
          expect(planned.filesystem_type).to be_nil
        end
      end
    end

    context "using the new format for Xen virtual partitions (one drive section per each)" do
      let(:scenario) { "xen-partitions.xml" }

      let(:disk_spec) do
        { "device" => "/dev/xvda1", "use" => "all", "partitions" => part_section }
      end

      let(:part_section) { [{ "filesystem" => :ext4 }] }

      it "reuses the given virtual partition" do
        devices = planner.planned_devices(drive)
        planned = devices.find { |d| d.reuse_name == "/dev/xvda1" }
        expect(planned.reuse_name).to eq("/dev/xvda1")
        expect(planned.filesystem_type).to eq(Y2Storage::Filesystems::Type::EXT4)
      end

      context "when a raid name is specified" do
        let(:part_section) { [{ "raid_name" => "/dev/md/0" }] }

        it "plans to use the partition as a MD member" do
          devices = planner.planned_devices(drive)
          planned = devices.find { |d| d.reuse_name == "/dev/xvda1" }
          expect(planned.raid_name).to eq "/dev/md/0"
        end
      end

      context "when a LVM volume group is specified" do
        let(:part_section) { [{ "lvm_group" => "system" }] }

        it "plans to use the partition as a LVM PV" do
          devices = planner.planned_devices(drive)
          planned = devices.find { |d| d.reuse_name == "/dev/xvda1" }
          expect(planned.lvm_volume_group_name).to eq "system"
        end
      end
    end

    context "using the whole disk" do
      let(:disk_spec) do
        { "device" => "/dev/sda", "partitions" => [root_spec] }
      end

      include_examples "handles bcache configuration"

      include_examples "handles conflicts"

      context "when a partition_nr is set to '0'" do
        include_examples "handles Btrfs snapshots"

        let(:root_spec) do
          { "mount" => "/", "filesystem" => "btrfs", "partition_nr" => 0 }
        end

        it "uses the whole disk" do
          devices = planner.planned_devices(drive)
          expect(devices).to contain_exactly(
            an_object_having_attributes("mount_point" => "/", "partitions" => [])
          )
        end
      end

      context "when disklabel is set to 'none'" do
        include_examples "handles Btrfs snapshots"

        let(:disk_spec) do
          { "device" => "/dev/sda", "disklabel" => "none", "partitions" => [root_spec] }
        end

        it "uses the whole disk" do
          devices = planner.planned_devices(drive)
          expect(devices).to contain_exactly(
            an_object_having_attributes("mount_point" => "/", "partitions" => [])
          )
        end
      end

      context "when trying to reuse a filesystem which does not exist" do
        let(:disk_spec) do
          { "device" => "/dev/sda", "disklabel" => "none", "partitions" => [root_spec] }
        end
        let(:root_spec) do
          { "create" => false, "format" => false, "mount" => "/" }
        end

        before do
          sda = Y2Storage::BlkDevice.find_by_name(fake_devicegraph, "/dev/sda")
          sda.remove_descendants
        end

        it "registers an issue" do
          expect(issues_list).to be_empty
          planner.planned_devices(drive)
          issue = issues_list.find do |i|
            i.is_a?(Y2Storage::AutoinstIssues::MissingReusableFilesystem)
          end
          expect(issue).to_not be_nil
        end
      end
    end

    context "specifying quotas support" do
      let(:root_spec) do
        { "mount" => "/", "filesystem" => "btrfs", "quotas" => quotas?, "subvolumes" => subvolumes }
      end

      let(:subvolumes) do
        [{ "path" => "@/var" }]
      end

      let(:planned_root) do
        disk = planner.planned_devices(drive).first
        disk.partitions.first
      end

      context "when quotas are enabled" do
        let(:quotas?) { true }

        it "enables the quotas" do
          expect(planned_root.quota?).to eq(true)
        end
      end

      context "when quotas are disabled" do
        let(:quotas?) { false }

        it "does not plan for quotas" do
          expect(planned_root.quota?).to eq(false)
        end

        context "and a subvolume requires quotas" do
          let(:subvolumes) do
            [{ "path" => "@/tmp", "referenced_limit" => "1GiB" }]
          end

          it "does not plan for quotas" do
            expect(planned_root.quota?).to eq(false)
          end
        end
      end

      context "when it not specified whether quotas must be enabled or not" do
        let(:root_spec) do
          { "mount" => "/", "filesystem" => "btrfs", "subvolumes" => subvolumes }
        end

        it "does not plan for quotas" do
          expect(planned_root.quota?).to eq(false)
        end

        context "but a subvolume requires quotas" do
          let(:subvolumes) do
            [{ "path" => "@/tmp", "referenced_limit" => "1GiB" }]
          end

          it "plans for quotas" do
            expect(planned_root.quota?).to eq(true)
          end

          it "reports an issue" do
            planner.planned_devices(drive)
            issue = planner.issues_list.find do |i|
              i.is_a?(Y2Storage::AutoinstIssues::MissingBtrfsQuotas)
            end
            expect(issue).to_not be_nil
          end
        end
      end
    end
  end
end
