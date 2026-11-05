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
require "y2storage/proposal/autoinst_md_planner"
require "installation/autoinst_issues/list"
require "y2storage/autoinst_profile/drive_section"

describe Y2Storage::Proposal::AutoinstMdPlanner do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject(:planner) { described_class.new(fake_devicegraph, issues_list) }
  let(:scenario) { "md_raid" }
  let(:issues_list) { ::Installation::AutoinstIssues::List.new }

  before do
    fake_scenario(scenario)
  end

  describe "#planned_devices" do
    let(:drive) { Y2Storage::AutoinstProfile::DriveSection.new_from_hashes(raid) }

    let(:raid) do
      {
        "device" => device, "raid_options" => raid_options, "disklabel" => disklabel,
        "partitions" => [root_spec]
      }
    end

    let(:root_spec) do
      { "mount" => "/", "filesystem" => "btrfs", "size" => "max", "partition_nr" => 1 }
    end

    let(:raid_options) do
      { "raid_type" => "raid5" }
    end

    let(:disklabel) { nil }

    let(:device) { "/dev/md2" }

    include_examples "handles Btrfs snapshots"

    it "returns a planned RAID with the given device name" do
      md = planner.planned_devices(drive).first
      expect(md.name).to eq("/dev/md2")
    end

    context "when a partition table type is specified" do
      let(:disklabel) { "msdos" }

      it "returns a planned MD RAID with partitions" do
        md = planner.planned_devices(drive).first
        expect(md.partitions).to contain_exactly(
          an_object_having_attributes("mount_point" => "/")
        )
      end

      it "sets the partition table type" do
        md = planner.planned_devices(drive).first
        expect(md.ptable_type).to eq(Y2Storage::PartitionTables::Type.find("msdos"))
      end
    end

    context "when no partition table type is specified" do
      it "returns a planned MD RAID with partitions" do
        md = planner.planned_devices(drive).first
        expect(md.partitions).to contain_exactly(
          an_object_having_attributes("mount_point" => "/")
        )
      end

      it "does not set the partition table type" do
        md = planner.planned_devices(drive).first
        expect(md.ptable_type).to be_nil
      end
    end

    context "when the partition table type is set to 'none'" do
      let(:disklabel) { "none" }

      include_examples "handles Btrfs snapshots"

      it "returns a planned MD RAID with filesystem settings (no partitions)" do
        md = planner.planned_devices(drive).first
        expect(md.mount_point).to eq("/")
        expect(md.filesystem_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
      end

      it "does not set the partition table type" do
        md = planner.planned_devices(drive).first
        expect(md.ptable_type).to be_nil
      end

      context "and RAID options are not specified at drive level" do
        let(:raid_options) { nil }
        let(:root_spec) do
          {
            "mount" => "/", "filesystem" => "btrfs", "size" => "max", "partition_nr" => 1,
            "raid_options" => { "raid_type" => "raid5" }
          }
        end

        it "reads options from the partition section" do
          md = planner.planned_devices(drive).first
          expect(md.md_level).to eq(Y2Storage::MdLevel::RAID5)
        end
      end
    end

    context "when no RAID level is specified" do
      let(:raid_options) { nil }

      it "assumes a RAID1" do
        md = planner.planned_devices(drive).first
        expect(md.md_level).to eq(Y2Storage::MdLevel::RAID1)
      end
    end

    context "when an invalid RAID level is specified" do
      let(:raid_options) do
        { "raid_type" => "non-valid-type" }
      end

      it "assumes a RAID1" do
        md = planner.planned_devices(drive).first
        expect(md.md_level).to eq(Y2Storage::MdLevel::RAID1)
      end

      it "registers an issue" do
        planner.planned_devices(drive).first
        issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::InvalidValue) }
        expect(issue).to_not be_nil
      end
    end

    context "when using a named RAID" do
      let(:device) { "/dev/md/data" }

      it "uses the name instead of a number" do
        md = planner.planned_devices(drive).first
        expect(md.name).to eq("/dev/md/data")
      end
    end

    context "using the old schema" do
      let(:raid) do
        { "device" => "/dev/md", "partitions" => [root_raid_spec, home_raid_spec] }
      end

      let(:raid_options) do
        { "raid_type" => "raid5" }
      end

      let(:root_partition_nr) { 1 }
      let(:root_raid_spec) do
        {
          "mount" => "/", "filesystem" => "ext4", "size" => "max",
          "partition_nr" => root_partition_nr, "raid_options" => { "raid_type" => "raid5" }
        }
      end

      let(:home_partition_nr) { 2 }
      let(:home_raid_spec) do
        {
          "mount" => "/home", "filesystem" => "xfs", "size" => "max",
          "partition_nr" => home_partition_nr, "raid_options" => { "raid_type" => "raid1" }
        }
      end

      it "returns a planned RAID using /dev/md/ + partition_nr as device name" do
        mds = planner.planned_devices(drive)
        expect(mds).to contain_exactly(
          an_object_having_attributes(
            "name" => "/dev/md/1", "md_level" => Y2Storage::MdLevel::RAID5
          ),
          an_object_having_attributes(
            "name" => "/dev/md/2", "md_level" => Y2Storage::MdLevel::RAID1
          )
        )
      end

      context "when a partition number is missing" do
        let(:home_partition_nr) { nil }

        it "does not include the partition in the planned RAID" do
          mds = planner.planned_devices(drive)
          expect(mds).to contain_exactly(
            an_object_having_attributes(
              "name" => "/dev/md/1", "md_level" => Y2Storage::MdLevel::RAID5
            )
          )
        end

        it "registers an issue" do
          planner.planned_devices(drive)
          issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::MissingValue) }
          expect(issue).to_not be_nil
        end
      end
    end

    describe "snapshots" do
      let(:raid) do
        {
          "device" => "/dev/md", "partitions" => [root_spec],
          "enable_snapshots" => enable_snapshots
        }
      end

      let(:enable_snapshots) { nil }

      it "plans for snapshots by default" do
        md = planner.planned_devices(drive).first
        expect(md.snapshots?).to eq(true)
      end

      context "when snapshots are disabled" do
        let(:enable_snapshots) { false }

        it "does not plan for enabling snapshots" do
          md = planner.planned_devices(drive).first
          expect(md.snapshots?).to eq(false)
        end
      end

      context "when snapshots are enabled" do
        let(:enable_snapshots) { true }

        it "plans for snapshots" do
          md = planner.planned_devices(drive).first
          expect(md.snapshots?).to eq(true)
        end
      end
    end
  end
end
