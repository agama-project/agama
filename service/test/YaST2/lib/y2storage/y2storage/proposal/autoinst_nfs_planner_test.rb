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
require "y2storage/proposal/autoinst_nfs_planner"
require "installation/autoinst_issues/list"
require "y2storage/autoinst_profile/drive_section"

describe Y2Storage::Proposal::AutoinstNfsPlanner do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)
  end

  let(:scenario) { "empty_hard_disk_15GiB" }

  subject(:planner) { described_class.new(fake_devicegraph, issues_list) }

  let(:issues_list) { ::Installation::AutoinstIssues::List.new }

  describe "#planned_devices" do
    shared_examples "create planned NFS" do
      it "does not register a 'missing value' issue" do
        planner.planned_devices(drive)

        issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::MissingValue) }
        expect(issue).to be_nil
      end

      it "plans a NFS filesystem" do
        expect(planner.planned_devices(drive)).to_not be_empty
      end

      it "sets the server" do
        planned_nfs = planner.planned_devices(drive).first

        expect(planned_nfs.server).to eq(server)
      end

      it "sets the shared path" do
        planned_nfs = planner.planned_devices(drive).first

        expect(planned_nfs.path).to eq(path)
      end

      it "sets the mount point" do
        planned_nfs = planner.planned_devices(drive).first

        expect(planned_nfs.mount_point).to eq(mount)
      end

      context "and the fstab options are not given" do
        let(:fstopt) { nil }

        it "does not set the fstab options" do
          planned_nfs = planner.planned_devices(drive).first

          expect(planned_nfs.fstab_options).to be_empty
        end
      end

      context "and the fstab options are given" do
        let(:fstopt) { "rw,wsize=8192" }

        it "sets the fstab options" do
          planned_nfs = planner.planned_devices(drive).first

          expect(planned_nfs.fstab_options).to contain_exactly("rw", "wsize=8192")
        end
      end
    end

    let(:drive) { Y2Storage::AutoinstProfile::DriveSection.new_from_hashes(drive_section) }

    context "when using the old profile format" do
      let(:drive_section) do
        { "device" => "/dev/nfs", "disklabel" => disklabel, "partitions" => partitions }
      end

      let(:disklabel) { nil }

      let(:partitions) { [partition_section1, partition_section2] }

      let(:partition_section1) do
        { "device" => "server:path1", "mount" => "/", "fstopt" => "rw,wsize=8192" }
      end

      let(:partition_section2) do
        { "device" => "server:path2", "mount" => "/home", "fstopt" => "rw" }
      end

      it "plans a NFS for each valid partition section" do
        planned_devices = planner.planned_devices(drive)

        expect(planned_devices.size).to eq(2)
        expect(planned_devices.map(&:mount_point)).to contain_exactly("/", "/home")
      end

      context "and the partition section does not contain a device value" do
        let(:partition_section) do
          { "mount" => "/", "fstopt" => "rw,wsize=8192" }
        end

        let(:partitions) { [partition_section] }

        it "does not plan a NFS filesystem" do
          expect(planner.planned_devices(drive)).to be_empty
        end

        it "registers a 'missing value' issue" do
          planner.planned_devices(drive)
          issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::MissingValue) }

          expect(issue).to_not be_nil
          expect(issue.attr).to eq(:device)
        end
      end

      context "and the partition section does not contain a mount value" do
        let(:partition_section) do
          { "device" => "192.168.56.1:/root_fs", "fstopt" => "rw,wsize=8192" }
        end

        let(:partitions) { [partition_section] }

        it "does not plan a NFS filesystem" do
          expect(planner.planned_devices(drive)).to be_empty
        end

        it "registers a 'missing value' issue" do
          planner.planned_devices(drive)
          issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::MissingValue) }

          expect(issue).to_not be_nil
          expect(issue.attr).to eq(:mount)
        end
      end

      context "and the partition section contains a device and a mount value" do
        let(:partition_section) do
          { "mount" => mount, "device" => device, "fstopt" => fstopt }
        end

        let(:partitions) { [partition_section] }

        let(:mount) { "/" }

        let(:device) { "#{server}:#{path}" }

        let(:server) { "192.168.56.1" }

        let(:path) { "/root_fs" }

        let(:fstopt) { nil }

        include_examples "create planned NFS"

        context "and a partition table is not required" do
          let(:disklabel) { "none" }

          it "does not register a 'no partitionable' issue" do
            planner.planned_devices(drive)
            issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::NoPartitionable) }

            expect(issue).to be_nil
          end
        end

        context "and a partition table is required" do
          let(:disklabel) { "gpt" }

          it "registers a 'no partitionable' issue" do
            planner.planned_devices(drive)
            issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::NoPartitionable) }

            expect(issue).to_not be_nil
          end
        end
      end
    end

    context "when using the new profile format" do
      let(:drive_section) { { "device" => device, "partitions" => partitions } }

      let(:partitions) { [] }

      context "and the drive section does not contain a device value" do
        let(:device) { nil }

        it "does not plan a NFS filesystem" do
          expect(planner.planned_devices(drive)).to be_empty
        end

        it "registers a 'missing value' issue" do
          planner.planned_devices(drive)
          issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::MissingValue) }

          expect(issue).to_not be_nil
          expect(issue.attr).to eq(:device)
        end
      end

      context "and the partition section does not contain a mount value" do
        let(:device) { "192.168.56.1:/root_fs" }

        let(:partitions) { [partition_section] }

        let(:partition_section) { { "mount" => nil, "fstopt" => "rw,wsize=8192" } }

        it "does not plan a NFS filesystem" do
          expect(planner.planned_devices(drive)).to be_empty
        end

        it "registers a 'missing value' issue" do
          planner.planned_devices(drive)
          issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::MissingValue) }

          expect(issue).to_not be_nil
          expect(issue.attr).to eq(:mount)
        end
      end

      context "and drive and partition sections contain all the mandatory values" do
        let(:drive_section) do
          { "device" => device, "disklabel" => disklabel, "partitions" => partitions }
        end

        let(:device) { "#{server}:#{path}" }

        let(:server) { "192.168.56.1" }

        let(:path) { "/root_fs" }

        let(:disklabel) { nil }

        let(:partitions) { [partition_section1] }

        let(:partition_section1) { { "mount" => mount, "fstopt" => fstopt } }

        let(:mount) { "/" }

        let(:fstopt) { nil }

        include_examples "create planned NFS"

        context "and a partition table is not required" do
          let(:disklabel) { "none" }

          it "does not register a 'no partitionable' issue" do
            planner.planned_devices(drive)
            issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::NoPartitionable) }

            expect(issue).to be_nil
          end
        end

        context "and a partition table is required" do
          let(:disklabel) { "gpt" }

          it "registers a 'no partitionable' issue" do
            planner.planned_devices(drive)
            issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::NoPartitionable) }

            expect(issue).to_not be_nil
          end
        end

        context "and there is only one partition section" do
          let(:partitions) { [partition_section1] }

          it "does not register a 'surplus partitions' issue" do
            planner.planned_devices(drive)
            issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::SurplusPartitions) }

            expect(issue).to be_nil
          end
        end

        context "and there is more than one partition section" do
          let(:partition_section2) { { "mount" => "/home" } }

          let(:partitions) { [partition_section1, partition_section2] }

          it "registers a 'surplus partitions' issue" do
            planner.planned_devices(drive)
            issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::SurplusPartitions) }

            expect(issue).to_not be_nil
          end

          it "plans a NFS filesystem according to the first partition section" do
            planned_devices = planner.planned_devices(drive)

            expect(planned_devices.size).to eq(1)
            expect(planned_devices.first.mount_point).to eq("/")
          end
        end
      end
    end
  end
end
