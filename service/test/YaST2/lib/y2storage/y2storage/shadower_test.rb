#!/usr/bin/env rspec
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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"
require "y2storage"
require "y2storage/shadower"

describe Y2Storage::Shadower do
  include_context "yast2-storage-ng test setup"

  before do
    allow(Y2Storage::VolumeSpecification).to receive(:for)
    allow(Y2Storage::VolumeSpecification).to receive(:for).with("/").and_return(root_spec)

    fake_scenario(scenario)
  end

  let(:root_spec) { instance_double(Y2Storage::VolumeSpecification, btrfs_default_subvolume: "@") }

  subject { described_class.new(devicegraph, filesystems: filesystems) }

  let(:blk_device) { Y2Storage::BlkDevice.find_by_name(devicegraph, dev_name) }

  let(:devicegraph) { Y2Storage::StorageManager.instance.staging }

  let(:scenario) { "mixed_disks_btrfs" }

  let(:dev_name) { "/dev/sda2" }

  # All filesystems by default
  let(:filesystems) { nil }

  describe "#refresh_shadowing" do
    let(:filesystem) { blk_device.filesystem }

    let(:subvolume) { filesystem.btrfs_subvolumes.find { |s| s.path == subvolume_path } }

    before do
      device = devicegraph.find_by_name("/dev/sdb5")
      device.filesystem.mount_path = device_mount_path
    end

    let(:device_mount_path) { "" }

    context "when a subvolume is not shadowed" do
      before do
        filesystem.create_btrfs_subvolume(subvolume_path, false)
      end

      let(:subvolume_path) { "@/foo" }

      it "does not remove the subvolume" do
        subject.refresh_shadowing

        expect(subvolume).to_not be_nil
      end

      context "when the subvolume has mount point" do
        before do
          subvolume.mount_path = "/foobar"
        end

        it "does not modify its mount point" do
          subject.refresh_shadowing

          expect(subvolume.mount_path).to eq("/foobar")
        end
      end

      context "when the subvolume has not mount point" do
        before do
          subvolume.remove_mount_point if subvolume.mount_point
        end

        context "and there is a default mount point for it" do
          it "adds the default mount point to the subvolume" do
            subject.refresh_shadowing

            expect(subvolume.mount_path).to eq("/foo")
          end
        end

        context "and there is no default mount point for it" do
          # The subvolume is created as child of @/tmp
          let(:subvolume_path) { "@/tmp/foo" }

          it "does not add a mount point to the subvolume" do
            subject.refresh_shadowing

            expect(subvolume.mount_path).to be_nil
          end
        end
      end
    end

    context "when a subvolume is shadowed" do
      before do
        subvolume = filesystem.create_btrfs_subvolume(subvolume_path, false)
        subvolume.can_be_auto_deleted = can_be_auto_deleted
      end

      let(:subvolume_path) { "@/foo" }

      let(:device_mount_path) { "/foo" }

      context "and the subvolume can be auto deleted" do
        let(:can_be_auto_deleted) { true }

        it "removes the subvolume" do
          expect(filesystem.find_btrfs_subvolume_by_path(subvolume_path)).to_not be(nil)
          subject.refresh_shadowing
          expect(filesystem.find_btrfs_subvolume_by_path(subvolume_path)).to be(nil)
        end

        it "adds the subvolume to the list of auto deleted subvolumes" do
          expect(filesystem.auto_deleted_subvolumes).to be_empty
          subject.refresh_shadowing
          expect(filesystem.auto_deleted_subvolumes).to include(
            an_object_having_attributes(path: subvolume_path)
          )
        end
      end

      context "and the subvolume cannot be auto deleted" do
        let(:can_be_auto_deleted) { false }

        it "does not remove the subvolume" do
          expect(filesystem.find_btrfs_subvolume_by_path(subvolume_path)).to_not be(nil)
          subject.refresh_shadowing
          expect(filesystem.find_btrfs_subvolume_by_path(subvolume_path)).to_not be(nil)
        end

        it "does not add the subvolume to the list of auto deleted subvolumes" do
          expect(filesystem.auto_deleted_subvolumes).to be_empty
          subject.refresh_shadowing
          expect(filesystem.auto_deleted_subvolumes).to be_empty
        end

        it "removes the mount point of the subvolume" do
          expect(subvolume.mount_path).to_not be_nil
          subject.refresh_shadowing
          expect(subvolume.mount_path).to be_nil
        end
      end
    end

    context "when a subvolume was auto deleted" do
      before do
        filesystem.auto_deleted_subvolumes = auto_deleted
      end

      let(:auto_deleted) { [subvolume_spec] }

      let(:subvolume_spec) { Y2Storage::SubvolSpecification.new(subvolume_path) }

      context "and the subvolume is not shadowed anymore" do
        let(:subvolume_path) { "@/foo" }

        it "adds the subvolume to the filesystem" do
          expect(filesystem.find_btrfs_subvolume_by_path(subvolume_path)).to be(nil)
          subject.refresh_shadowing
          expect(filesystem.find_btrfs_subvolume_by_path(subvolume_path)).to_not be(nil)
        end

        it "removes the subvolume from the list of auto deleted subvolumes" do
          expect(filesystem.auto_deleted_subvolumes).to include(
            an_object_having_attributes(path: subvolume_path)
          )

          subject.refresh_shadowing

          expect(filesystem.auto_deleted_subvolumes).to_not include(
            an_object_having_attributes(path: subvolume_path)
          )
        end
      end

      context "and the subvolume is still shadowed" do
        let(:subvolume_path) { "@/foo/bar" }

        let(:device_mount_path) { "/foo" }

        it "does not add the subvolume to the filesystem" do
          expect(filesystem.find_btrfs_subvolume_by_path(subvolume_path)).to be(nil)
          subject.refresh_shadowing
          expect(filesystem.find_btrfs_subvolume_by_path(subvolume_path)).to be(nil)
        end

        it "does not remove the subvolume from the list of auto deleted subvolumes" do
          expect(filesystem.auto_deleted_subvolumes).to include(
            an_object_having_attributes(path: subvolume_path)
          )

          subject.refresh_shadowing

          expect(filesystem.auto_deleted_subvolumes).to include(
            an_object_having_attributes(path: subvolume_path)
          )
        end
      end
    end

    context "when a filesystem is not included in the list of filesystems to consider" do
      let(:filesystems) { [devicegraph.find_by_name("/dev/sda1").filesystem] }

      context "and a subvolume is shadowed" do
        before do
          filesystem.create_btrfs_subvolume(subvolume_path, false)
        end

        let(:subvolume_path) { "@/foo" }

        let(:device_mount_path) { "/foo" }

        it "does not remove the subvolume" do
          expect(filesystem.find_btrfs_subvolume_by_path(subvolume_path)).to_not be(nil)
          subject.refresh_shadowing
          expect(filesystem.find_btrfs_subvolume_by_path(subvolume_path)).to_not be(nil)
        end

        it "does not modify the mount point of the subvolume" do
          subject.refresh_shadowing
          expect(subvolume.mount_path).to eq("/foo")
        end
      end

      context "and a subvolume was auto deleted" do
        before do
          filesystem.auto_deleted_subvolumes = auto_deleted
        end

        let(:auto_deleted) { [subvolume_spec] }

        let(:subvolume_spec) { Y2Storage::SubvolSpecification.new(subvolume_path) }

        context "and the subvolume is not shadowed anymore" do
          let(:subvolume_path) { "@/foo" }

          it "does not add the subvolume to the filesystem" do
            expect(filesystem.find_btrfs_subvolume_by_path(subvolume_path)).to be(nil)
            subject.refresh_shadowing
            expect(filesystem.find_btrfs_subvolume_by_path(subvolume_path)).to be(nil)
          end
        end
      end

      context "and a subvolume is not shadowed" do
        let(:subvolume_path) { "@/foo" }

        before do
          subvolume = filesystem.create_btrfs_subvolume(subvolume_path, false)
          subvolume.remove_mount_point
        end

        it "does not add a mount point to the subvolume" do
          subject.refresh_shadowing

          expect(subvolume.mount_path).to be_nil
        end
      end
    end
  end

  describe ".shadowing?" do
    context "when a mount point is shadowing another mount point" do
      let(:mount_point) { "/foo" }
      let(:other_mount_point) { "/foo/bar" }

      it "returns true" do
        expect(described_class.shadowing?(mount_point, other_mount_point)).to eq(true)
      end
    end

    context "when a mount point is not shadowing another mount point" do
      let(:mount_point) { "/foo" }
      let(:other_mount_point) { "/foobar" }

      it "returns false" do
        expect(described_class.shadowing?(mount_point, other_mount_point)).to eq(false)
      end
    end
  end
end
