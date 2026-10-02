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
require "y2storage/proposal/autoinst_bcache_planner"
require "installation/autoinst_issues/list"
require "y2storage/autoinst_profile/drive_section"

describe Y2Storage::Proposal::AutoinstBcachePlanner do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject(:planner) { described_class.new(fake_devicegraph, issues_list) }
  let(:scenario) { "bcache1.xml" }
  let(:issues_list) { ::Installation::AutoinstIssues::List.new }

  before do
    fake_scenario(scenario)
  end

  describe "#planned_devices" do
    let(:drive) { Y2Storage::AutoinstProfile::DriveSection.new_from_hashes(bcache) }
    let(:disklabel) { nil }

    let(:bcache) do
      {
        "device" => "/dev/bcache0", "disklabel" => disklabel,
        "bcache_options" => { "cache_mode" => "writeback" },
        "partitions" => [root_spec]
      }
    end

    let(:root_spec) do
      { "mount" => "/", "filesystem" => :btrfs, "size" => "max", "format" => true }
    end

    it "returns a planned bcache device with the given device name" do
      bcache = planner.planned_devices(drive).first
      expect(bcache.name).to eq("/dev/bcache0")
    end

    it "sets cache options" do
      bcache = planner.planned_devices(drive).first
      expect(bcache.cache_mode).to eq(Y2Storage::CacheMode::WRITEBACK)
    end

    context "when running on a different x86_64 architecture" do
      before do
        allow(Yast::Arch).to receive(:x86_64).and_return(false)
      end

      it "registers an issue" do
        planner.planned_devices(drive).first
        issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::UnsupportedDriveSection) }
        expect(issue).to_not be_nil
      end
    end

    context "when caching mode is set to an invalid value are not specified" do
      let(:bcache) do
        {
          "device" => "/dev/bcache0", "disklabel" => disklabel,
          "partitions" => [root_spec]
        }
      end

      it "does not set caching options" do
        bcache = planner.planned_devices(drive).first
        expect(bcache.cache_mode).to eq(nil)
      end
    end

    context "when caching mode is set to an invalid value" do
      let(:bcache) do
        {
          "device" => "/dev/bcache0", "disklabel" => disklabel,
          "bcache_options" => { "cache_mode" => "RANDOM" },
          "partitions" => [root_spec]
        }
      end

      it "does not set caching options" do
        bcache = planner.planned_devices(drive).first
        expect(bcache.cache_mode).to eq(nil)
      end

      it "registers an issue" do
        planner.planned_devices(drive).first
        issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::InvalidValue) }
        expect(issue.section).to eq(drive.bcache_options)
        expect(issue.value).to eq("RANDOM")
        expect(issue.new_value).to eq(:skip)
      end
    end

    context "when a partition table type is specified" do
      let(:disklabel) { "msdos" }

      it "returns a planned bcache with partitions" do
        bcache = planner.planned_devices(drive).first
        expect(bcache.partitions).to contain_exactly(
          an_object_having_attributes("mount_point" => "/")
        )
      end

      it "sets the partition table" do
        bcache = planner.planned_devices(drive).first
        expect(bcache.ptable_type).to eq(Y2Storage::PartitionTables::Type.find("msdos"))
      end
    end

    context "when a partition table type is specified" do
      it "returns a planned bcache with partitions" do
        bcache = planner.planned_devices(drive).first
        expect(bcache.partitions).to contain_exactly(
          an_object_having_attributes("mount_point" => "/")
        )
      end

      it "does not set the partition table type" do
        bcache = planner.planned_devices(drive).first
        expect(bcache.ptable_type).to be_nil
      end
    end

    context "when the partition table type is set to 'none'" do
      let(:disklabel) { "none" }

      it "returns a planned bcache with filesystem settings (no partitions)" do
        md = planner.planned_devices(drive).first
        expect(md.mount_point).to eq("/")
        expect(md.filesystem_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
      end

      it "does not set the partition table type" do
        bcache = planner.planned_devices(drive).first
        expect(bcache.ptable_type).to be_nil
      end
    end

    context "reusing an bcache partition" do
      let(:root_spec) do
        { "create" => false, "format" => false, "mount" => "/", "partition_nr" => 1 }
      end

      it "sets the bcache to be reused" do
        bcache = planner.planned_devices(drive).first
        expect(bcache.reuse_name).to eq("/dev/bcache0")
      end
    end

    describe "snapshots" do
      let(:bcache) do
        {
          "device" => "/dev/bcache0", "disklabel" => disklabel,
          "partitions" => [root_spec], "enable_snapshots" => enable_snapshots
        }
      end

      let(:enable_snapshots) { nil }

      it "plans for snapshots by default" do
        bcache = planner.planned_devices(drive).first
        expect(bcache.partitions.first.snapshots?).to eq(true)
      end

      context "when snapshots are disabled" do
        let(:enable_snapshots) { false }

        it "does not plan for enabling snapshots" do
          bcache = planner.planned_devices(drive).first
          expect(bcache.partitions.first.snapshots?).to eq(false)
        end
      end

      context "when snapshots are enabled" do
        let(:enable_snapshots) { true }

        it "plans for snapshots" do
          bcache = planner.planned_devices(drive).first
          expect(bcache.partitions.first.snapshots?).to eq(true)
        end
      end
    end
  end
end
