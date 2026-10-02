# frozen_string_literal: true

# Copyright (c) [2020] SUSE LLC
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

RSpec.shared_examples "handles conflicts" do
  def planned_device(disk)
    if disk.partitions.empty?
      disk
    else
      disk.partitions.first
    end
  end

  def added_issue
    issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::ConflictingAttrs) }
  end

  context "when conflicting attributes specify different usages for the device" do
    let(:root_spec) do
      {
        "mount" => "/", "raid_name" => "/dev/md0", "lvm_group" => "vg0",
        "btrfs_name" => "root", "bcache_backing_for" => "/dev/bcache0",
        "bcache_caching_for" => "/dev/bcache1"
      }
    end
    let(:missing_attrs) { [] }

    before do
      root_spec.delete_if { |k, _v| missing_attrs.include?(k) }
    end

    it "prefers the filesystem" do
      disk = planner.planned_devices(drive).first
      expect(planned_device(disk).mount_point).to eq("/")
    end

    it "registers an issue" do
      planner.planned_devices(drive)
      expect(added_issue.selected_attr).to eq(:mount)
    end

    context "and the 'mount' attribute is missing" do
      let(:missing_attrs) { ["mount"] }

      it "prefers the raid_name" do
        disk = planner.planned_devices(drive).first
        expect(planned_device(disk).raid_name).to eq("/dev/md0")
      end

      it "registers an issue" do
        planner.planned_devices(drive)
        expect(added_issue.selected_attr).to eq(:raid_name)
      end
    end

    context "and 'mount' and 'raid_name' attributes are missing" do
      let(:missing_attrs) { ["mount", "raid_name"] }

      it "prefers the lvm_group" do
        disk = planner.planned_devices(drive).first
        expect(planned_device(disk).lvm_volume_group_name).to eq("vg0")
      end

      it "registers an issue" do
        planner.planned_devices(drive)
        expect(added_issue.selected_attr).to eq(:lvm_group)
      end
    end

    context "and 'mount', 'raid_name' and 'lvm_group' attributes are missing" do
      let(:missing_attrs) { ["mount", "raid_name", "lvm_group"] }

      it "prefers the btrfs_name" do
        disk = planner.planned_devices(drive).first
        expect(planned_device(disk).btrfs_name).to eq("root")
      end

      it "registers an issue" do
        planner.planned_devices(drive)
        expect(added_issue.selected_attr).to eq(:btrfs_name)
      end
    end

    context "and 'mount', 'raid_name' and 'lvm_group' and 'btrfs_name' attributes are missing" do
      let(:missing_attrs) { ["mount", "raid_name", "lvm_group", "btrfs_name"] }

      it "prefers the bcache_backing_for" do
        disk = planner.planned_devices(drive).first
        expect(planned_device(disk).bcache_backing_for).to eq("/dev/bcache0")
      end

      it "registers an issue" do
        planner.planned_devices(drive)
        expect(added_issue.selected_attr).to eq(:bcache_backing_for)
      end
    end

    context "only 'bcache_caching_for' is present" do
      let(:missing_attrs) do
        ["mount", "raid_name", "lvm_group", "btrfs_name", "bcache_backing_for"]
      end

      it "prefers the bcache_caching_for" do
        disk = planner.planned_devices(drive).first
        expect(planned_device(disk).bcache_caching_for).to eq("/dev/bcache1")
      end

      it "does not register an issue" do
        planner.planned_devices(drive)
        expect(added_issue).to be_nil
      end
    end
  end
end
