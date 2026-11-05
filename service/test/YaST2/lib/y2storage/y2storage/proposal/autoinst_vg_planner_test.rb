#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2018-2019] SUSE LLC
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
require "y2storage/proposal/autoinst_vg_planner"
require "installation/autoinst_issues/list"
require "y2storage/autoinst_profile/drive_section"

describe Y2Storage::Proposal::AutoinstVgPlanner do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject(:planner) { described_class.new(fake_devicegraph, issues_list) }

  let(:scenario) { "windows-linux-free-pc" }
  let(:issues_list) { ::Installation::AutoinstIssues::List.new }

  before do
    fake_scenario(scenario)
  end

  describe "#planned_devices" do
    let(:drive) { Y2Storage::AutoinstProfile::DriveSection.new_from_hashes(vg) }

    let(:vg) do
      { "device" => "/dev/#{lvm_group}", "partitions" => partitions,
        "type" => :CT_LVM, "pesize" => "8M" }
    end

    let(:root_spec) do
      {
        "mount" => "/", "filesystem" => "btrfs", "lv_name" => "root", "size" => "20G",
        "label" => "rootfs", "stripes" => 2, "stripe_size" => 4
      }
    end

    let(:lvm_group) { "vg0" }

    let(:partitions) { [root_spec] }

    include_examples "handles Btrfs snapshots"

    it "returns volume group and logical volumes" do
      vg = planner.planned_devices(drive).first
      expect(vg).to be_a(Y2Storage::Planned::LvmVg)
      expect(vg).to have_attributes(
        "volume_group_name" => lvm_group,
        "reuse_name"        => nil,
        "extent_size"       => 8.MiB
      )
      expect(vg.lvs).to contain_exactly(
        an_object_having_attributes(
          "logical_volume_name" => "root",
          "mount_point"         => "/",
          "reuse_name"          => nil,
          "min_size"            => 20.GiB,
          "max_size"            => 20.GiB,
          "label"               => "rootfs",
          "stripes"             => 2,
          "stripe_size"         => 4.KiB
        )
      )
    end

    context "when the PV is a partition with number 0" do
      it "uses the whole disk device as PV" do
        vg = planner.planned_devices(drive).first
        expect(vg).to be_a(Y2Storage::Planned::LvmVg)
        expect(vg).to have_attributes(
          "volume_group_name" => lvm_group,
          "reuse_name"        => nil
        )
      end
    end

    context "specifying size" do
      using Y2Storage::Refinements::SizeCasts

      let(:root_spec) do
        { "mount" => "/", "filesystem" => "ext4", "lv_name" => "root", "size" => size }
      end

      context "when only a number is given" do
        let(:size) { "10" }

        it "sets the size according to that number and using unit B" do
          vg = planner.planned_devices(drive).first
          root_lv = vg.lvs.first
          expect(root_lv.min_size).to eq(Y2Storage::DiskSize.B(10))
          expect(root_lv.max_size).to eq(Y2Storage::DiskSize.B(10))
        end
      end

      context "when a number+unit is given" do
        let(:size) { "5GB" }

        it "sets the size according to that number and using unit B" do
          vg = planner.planned_devices(drive).first
          root_lv = vg.lvs.first
          expect(root_lv.min_size).to eq(5.GiB)
          expect(root_lv.max_size).to eq(5.GiB)
        end
      end

      context "when a percentage is given" do
        let(:size) { "50%" }

        it "sets the 'percent_size' value" do
          vg = planner.planned_devices(drive).first
          root_lv = vg.lvs.first
          expect(root_lv).to have_attributes("percent_size" => 50)
        end
      end

      context "when 'max' is given" do
        let(:size) { "max" }

        it "sets the size according to that number and using unit B" do
          vg = planner.planned_devices(drive).first
          root_lv = vg.lvs.first
          expect(root_lv.min_size).to eq(vg.extent_size)
          expect(root_lv.max_size).to eq(Y2Storage::DiskSize.unlimited)
        end

        it "sets the weight to '1'" do
          vg = planner.planned_devices(drive).first
          root_lv = vg.lvs.first
          expect(root_lv.weight).to eq(1)
        end
      end

      context "when an invalid value is given" do
        let(:size) { "huh?" }

        it "skips the volume" do
          vg = planner.planned_devices(drive).first
          expect(vg.lvs).to be_empty
        end

        it "registers an issue" do
          expect(issues_list).to be_empty
          planner.planned_devices(drive).first
          issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::InvalidValue) }
          expect(issue.value).to eq("huh?")
          expect(issue.attr).to eq(:size)
          expect(issue.new_value).to eq(:skip)
        end
      end
    end

    context "reusing logical volumes" do
      let(:scenario) { "lvm-two-vgs" }

      context "when volume name is specified" do
        let(:root_spec) do
          {
            "create" => false, "mount" => "/", "filesystem" => "ext4", "lv_name" => "lv1",
            "size" => "20G"
          }
        end

        it "sets the reuse_name attribute of the volume group" do
          vg = planner.planned_devices(drive).first
          expect(vg.reuse_name).to eq(lvm_group)
          expect(vg.make_space_policy).to eq(:remove)
        end

        it "sets the reuse_name attribute of logical volumes" do
          vg = planner.planned_devices(drive).first
          expect(vg.reuse_name).to eq(lvm_group)
          expect(vg.lvs).to contain_exactly(
            an_object_having_attributes(
              "logical_volume_name" => "lv1",
              "reuse_name"          => "/dev/vg0/lv1"
            )
          )
        end

        context "when the filesystem does not exist" do
          before do
            lv = fake_devicegraph.find_by_name("/dev/vg0/lv1")
            lv.remove_descendants
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

      context "when label is specified" do
        let(:root_spec) do
          {
            "create" => false, "mount" => "/", "filesystem" => "ext4",
            "size" => "20G", "label" => "rootfs"
          }
        end

        it "sets the reuse_name attribute of logical volumes" do
          vg = planner.planned_devices(drive).first
          expect(vg.reuse_name).to eq(lvm_group)
          expect(vg.lvs).to contain_exactly(
            an_object_having_attributes(
              "logical_volume_name" => "lv2",
              "reuse_name"          => "/dev/vg0/lv2"
            )
          )
        end
      end

      context "when the logical volume to be reused does not exist" do
        let(:root_spec) do
          {
            "create" => false, "mount" => "/", "filesystem" => "ext4", "lv_name" => "new_lv",
            "size" => "20G"
          }
        end

        it "adds a new logical volume" do
          vg = planner.planned_devices(drive).first
          expect(vg.reuse_name).to be_nil
          expect(vg.lvs).to contain_exactly(
            an_object_having_attributes(
              "logical_volume_name" => "new_lv",
              "reuse_name"          => nil
            )
          )
        end

        it "registers an issue" do
          expect(issues_list).to be_empty
          planner.planned_devices(drive).first
          issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::MissingReusableDevice) }
          expect(issue).to_not be_nil
        end
      end

      context "when no volume name or label is specified" do
        let(:root_spec) do
          {
            "create" => false, "mount" => "/", "filesystem" => "ext4", "size" => "20G"
          }
        end

        it "adds a new logical volume" do
          vg = planner.planned_devices(drive).first
          expect(vg.reuse_name).to be_nil
          expect(vg.lvs).to contain_exactly(
            an_object_having_attributes(
              "reuse_name" => nil
            )
          )
        end

        it "registers an issue" do
          expect(issues_list).to be_empty
          planner.planned_devices(drive).first
          issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::MissingReuseInfo) }
          expect(issue).to_not be_nil
        end

        it "does not register a missing reusable device error" do
          expect(issues_list).to be_empty
          planner.planned_devices(drive).first
          issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::MissingReusableDevice) }
          expect(issue).to be_nil
        end
      end

      context "when the volume group does not exist" do
        let(:vg) do
          { "device" => "/dev/dummy", "partitions" => [root_spec], "type" => :CT_LVM }
        end

        let(:root_spec) do
          {
            "create" => false, "mount" => "/", "filesystem" => "ext4", "lv_name" => "lv1",
            "size" => "20G"
          }
        end

        it "registers an issue" do
          expect(issues_list).to be_empty
          planner.planned_devices(drive).first
          issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::MissingReusableDevice) }
          expect(issue).to_not be_nil
        end
      end
    end

    context "when unknown logical volumes are required to be kept" do
      let(:scenario) { "lvm-two-vgs" }

      let(:vg) do
        {
          "device" => "/dev/#{lvm_group}", "partitions" => [root_spec], "type" => :CT_LVM,
          "keep_unknown_lv" => true
        }
      end

      it "sets the reuse_name attribute of the volume group" do
        vg = planner.planned_devices(drive).first
        expect(vg).to have_attributes(
          "volume_group_name" => lvm_group,
          "reuse_name"        => lvm_group,
          "make_space_policy" => :keep
        )
      end

      context "but volume group does not exist" do
        let(:vg) do
          {
            "device" => "/dev/dummy", "partitions" => [root_spec], "type" => :CT_LVM,
            "keep_unknown_lv" => true
          }
        end

        it "adds a new volume group" do
          vg = planner.planned_devices(drive).first
          expect(vg).to have_attributes(
            "volume_group_name" => "dummy",
            "reuse_name"        => nil,
            "make_space_policy" => :keep
          )
        end

        it "registers an issue" do
          expect(issues_list).to be_empty
          planner.planned_devices(drive).first
          issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::MissingReusableDevice) }
          expect(issue).to_not be_nil
        end
      end
    end

    context "when trying to reuse a logical volume which is in another volume group" do
      let(:lvm_group) { "vg1" }
      let(:scenario) { "lvm-two-vgs" }

      let(:root_spec) do
        {
          "create" => false, "mount" => "/", "filesystem" => "ext4", "lv_name" => "lv2",
          "size" => "20G", "label" => "rootfs"
        }
      end

      it "does not set the reuse_name attribute of the logical volume" do
        vg = planner.planned_devices(drive).first
        expect(vg.lvs).to contain_exactly(
          an_object_having_attributes(
            "logical_volume_name" => "lv2",
            "reuse_name"          => nil
          )
        )
      end
    end

    context "using a thin pool" do
      let(:vg) do
        {
          "device" => "/dev/#{lvm_group}", "partitions" => [root_spec, home_spec, pool_spec],
          "type" => :CT_LVM, "keep_unknown_lv" => true
        }
      end

      let(:pool_spec) do
        { "create" => true, "pool" => true, "lv_name" => "pool0", "size" => "20G" }
      end

      let(:root_spec) do
        {
          "create" => true, "mount" => "/", "filesystem" => "ext4", "lv_name" => "root",
          "size" => "10G", "used_pool" => "pool0"
        }
      end

      let(:home_spec) do
        {
          "create" => true, "mount" => "/home", "filesystem" => "ext4", "lv_name" => "home",
          "size" => "10G", "used_pool" => "pool0"
        }
      end

      it "sets lv_type and thin pool name" do
        vg = planner.planned_devices(drive).first
        pool = vg.lvs.find { |v| v.logical_volume_name == "pool0" }

        expect(pool.lv_type).to eq(Y2Storage::LvType::THIN_POOL)
        expect(pool.thin_lvs).to include(
          an_object_having_attributes(
            "logical_volume_name" => "root",
            "lv_type"             => Y2Storage::LvType::THIN
          ),
          an_object_having_attributes(
            "logical_volume_name" => "home",
            "lv_type"             => Y2Storage::LvType::THIN
          )
        )
      end

      context "when the thin pool is not defined" do
        let(:pool_spec) do
          { "create" => true, "pool" => true, "lv_name" => "pool1", "size" => "20G" }
        end

        it "registers an issue" do
          planner.planned_devices(drive).first
          issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::ThinPoolNotFound) }
          expect(issue).to_not be_nil
        end
      end
    end

    context "when a Logical Volume is set as Bcache backing device" do
      let(:partitions) { [lv1] }

      let(:lv1) { { "size" => "20G", "bcache_backing_for" => "/dev/bcache0" } }

      it "plans the Logical Volume as backing device" do
        vg = planner.planned_devices(drive).first
        lv = vg.lvs.first

        expect(lv.bcache_backing_for).to eq("/dev/bcache0")
      end
    end

    context "when a Logical Volume is set as Bcache caching device" do
      let(:partitions) { [lv1] }

      let(:lv1) { { "size" => "20G", "bcache_caching_for" => ["/dev/bcache0"] } }

      it "plans the Logical Volume as caching device" do
        vg = planner.planned_devices(drive).first
        lv = vg.lvs.first

        expect(lv.bcache_caching_for).to eq(["/dev/bcache0"])
      end
    end
  end
end
