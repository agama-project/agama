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
require_relative "../../support/autoinst_devices_planner_btrfs"
require "y2storage/proposal/autoinst_btrfs_planner"
require "installation/autoinst_issues/list"
require "y2storage/autoinst_profile/drive_section"

describe Y2Storage::Proposal::AutoinstBtrfsPlanner do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)
  end

  subject { described_class.new(fake_devicegraph, issues_list) }

  let(:scenario) { "btrfs2-devicegraph.xml" }

  let(:issues_list) { ::Installation::AutoinstIssues::List.new }

  describe "#planned_devices" do
    let(:drive) { Y2Storage::AutoinstProfile::DriveSection.new_from_hashes(btrfs_spec) }

    let(:btrfs_spec) do
      {
        "device"        => btrfs_name,
        "btrfs_options" => {
          "data_raid_level"     => data_raid_level,
          "metadata_raid_level" => metadata_raid_level
        },
        "partitions"    => partitions_spec
      }
    end

    let(:btrfs_name) { "root_fs" }

    let(:data_raid_level) { nil }

    let(:metadata_raid_level) { nil }

    let(:partitions_spec) { [partition_spec] }

    let(:partition_spec) { { "mount" => "/" } }

    include_examples "handles Btrfs snapshots"

    let(:planned_btrfs) { subject.planned_devices(drive).first }

    it "returns a planned Btrfs with the given name" do
      expect(planned_btrfs.name).to eq(btrfs_name)
    end

    context "when the partition section specifies the mount point" do
      let(:partition_spec) { { "mount" => "/" } }

      it "sets the mount point" do
        expect(planned_btrfs.mount_point).to eq("/")
      end
    end

    context "when the partition section does not specify the mount point" do
      let(:partition_spec) { {} }

      it "does not set the mount point" do
        expect(planned_btrfs.mount_point).to be_nil
      end
    end

    context "when the partition section specifies the label" do
      let(:partition_spec) { { "label" => "my_btrfs" } }

      it "sets the label" do
        expect(planned_btrfs.label).to eq("my_btrfs")
      end
    end

    context "when the partition section does not specify the label" do
      let(:partition_spec) { {} }

      it "does not set the label" do
        expect(planned_btrfs.label).to be_nil
      end
    end

    context "when the partition section specifies the uuid" do
      let(:partition_spec) { { "uuid" => "111-2222-33333" } }

      it "does not set the uuid" do
        expect(planned_btrfs.uuid).to be_nil
      end
    end

    context "when the partition section does not specify the uuid" do
      let(:partition_spec) { {} }

      it "does not set the uuid" do
        expect(planned_btrfs.uuid).to be_nil
      end
    end

    context "when the partition section specifies the filesystem type" do
      let(:partition_spec) { { "filesystem" => "ext4" } }

      it "sets the filesystem type to btrfs" do
        expect(planned_btrfs.filesystem_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
      end
    end

    context "when the partition section does not specify the filesystem type" do
      let(:partition_spec) { {} }

      it "sets the filesystem type to btrfs" do
        expect(planned_btrfs.filesystem_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
      end
    end

    context "when the partition section specifies the mount by" do
      let(:partition_spec) { { "mountby" => "device" } }

      it "sets the mount by" do
        expect(planned_btrfs.mount_by).to eq(Y2Storage::Filesystems::MountByType::DEVICE)
      end
    end

    context "when the partition section does not specify the mount by" do
      let(:partition_spec) { {} }

      it "does not set the mount by" do
        expect(planned_btrfs.mount_by).to be_nil
      end
    end

    context "when the partition section specifies the mkfs options" do
      let(:partition_spec) { { "mkfs_options" => "-L label" } }

      it "sets the mkfs options" do
        expect(planned_btrfs.mkfs_options).to eq("-L label")
      end
    end

    context "when the partition section does not specify the mkfs options" do
      let(:partition_spec) { {} }

      it "does not set the mkfs options" do
        expect(planned_btrfs.mkfs_options).to be_nil
      end
    end

    context "when the partition section specifies the fstab options" do
      let(:partition_spec) { { "fstab_options" => "rw" } }

      it "sets the fstab options" do
        expect(planned_btrfs.fstab_options).to eq("rw")
      end
    end

    context "when the partition section does not specify the fstab options" do
      let(:partition_spec) { {} }

      it "does not set the fstab options" do
        expect(planned_btrfs.fstab_options).to be_nil
      end
    end

    context "when the btrfs options specifies a data raid level" do
      let(:data_raid_level) { Y2Storage::BtrfsRaidLevel::RAID1 }

      it "sets the data raid level" do
        expect(planned_btrfs.data_raid_level).to eq(Y2Storage::BtrfsRaidLevel::RAID1)
      end
    end

    context "when the btrfs options does not specify a data raid level" do
      let(:data_raid_level) { nil }

      it "sets data raid level to DEFAULT" do
        expect(planned_btrfs.data_raid_level).to eq(Y2Storage::BtrfsRaidLevel::DEFAULT)
      end
    end

    context "when the btrfs options specifies a metadata raid level" do
      let(:metadata_raid_level) { Y2Storage::BtrfsRaidLevel::RAID10 }

      it "sets the metadata raid level" do
        expect(planned_btrfs.metadata_raid_level).to eq(Y2Storage::BtrfsRaidLevel::RAID10)
      end
    end

    context "when the btrfs options does not specify a metadata raid level" do
      let(:metadata_raid_level) { nil }

      it "sets metadata raid level to DEFAULT" do
        expect(planned_btrfs.metadata_raid_level).to eq(Y2Storage::BtrfsRaidLevel::DEFAULT)
      end
    end

    shared_examples "cannot reuse" do
      it "does not reuse any filesystem" do
        expect(planned_btrfs.reuse_sid).to be_nil
      end

      it "adds a missing reusable device issue" do
        subject.planned_devices(drive)

        issue = subject.issues_list.find do |i|
          i.is_a?(Y2Storage::AutoinstIssues::MissingReusableDevice)
        end

        expect(issue).to_not be_nil
      end
    end

    context "when the filesystem should be reused" do
      let(:partition_spec) { { "create" => false, "uuid" => uuid } }

      context "and the uuid of the original filesystem is not indicated" do
        let(:uuid) { nil }

        include_examples "cannot reuse"
      end

      context "and the uuid of the original filesystem is indicated" do
        context "but there is no filesystem with such uuid" do
          let(:uuid) { "not-found" }

          include_examples "cannot reuse"
        end

        context "and there is a filesystem with such uuid" do
          let(:uuid) { "b7b96325-feb5-4e7e-a7f4-014ce2402e71" }

          let(:filesystem) { fake_devicegraph.find_by_name("/dev/sdb1").filesystem }

          it "reuses the existing filesystem" do
            expect(planned_btrfs.reuse_sid).to eq(filesystem.sid)
          end

          it "does not add a missing reusable device issue" do
            subject.planned_devices(drive)

            issue = subject.issues_list.find do |i|
              i.is_a?(Y2Storage::AutoinstIssues::MissingReusableDevice)
            end

            expect(issue).to be_nil
          end
        end
      end
    end

    context "when there are several partitions in the partitions section" do
      let(:partitions_spec) { [partition_spec, partition2_spec] }

      let(:partition2_spec) { { "mount" => "/home" } }

      it "adds a 'surplus partitions' issue" do
        subject.planned_devices(drive)

        issue = subject.issues_list.find do |i|
          i.is_a?(Y2Storage::AutoinstIssues::SurplusPartitions)
        end

        expect(issue).to_not be_nil
      end
    end

    context "when create partitions is required" do
      before do
        btrfs_spec.merge!("disklabel" => "gpt")
      end

      it "adds a 'no partitionable' issue" do
        subject.planned_devices(drive)

        issue = subject.issues_list.find do |i|
          i.is_a?(Y2Storage::AutoinstIssues::NoPartitionable)
        end

        expect(issue).to_not be_nil
      end
    end
  end
end
