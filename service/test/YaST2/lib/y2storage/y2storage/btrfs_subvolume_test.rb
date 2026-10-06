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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"

require "y2storage"

describe Y2Storage::BtrfsSubvolume do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  before do
    allow(Y2Storage::VolumeSpecification).to receive(:for).with("/").and_return(root_spec)

    fake_scenario(scenario)
  end

  let(:root_spec) { instance_double(Y2Storage::VolumeSpecification, btrfs_default_subvolume: "@") }

  let(:blk_device) { devicegraph.find_by_name(dev_name) }

  let(:devicegraph) { Y2Storage::StorageManager.instance.staging }

  let(:scenario) { "mixed_disks_btrfs" }

  let(:dev_name) { "/dev/sda2" }

  subject(:subvolume) { blk_device.filesystem.btrfs_subvolumes.find { |s| s.path == subvolume_path } }

  let(:subvolume_path) { "@/home" }

  describe "#set_default_mount_point" do
    before do
      blk_device.filesystem.remove_mount_point
      blk_device.filesystem.create_mount_point(fs_mount_path)
    end

    shared_examples "default not required" do
      context "and it has a mount point" do
        before do
          subject.mount_path = "/home"
        end

        it "removes the mount point" do
          subject.set_default_mount_point

          expect(subject.mount_point).to be_nil
        end
      end

      context "and it has no mount point" do
        before do
          subject.remove_mount_point if subject.mount_point
        end

        it "does not add a mount point" do
          subject.set_default_mount_point

          expect(subject.mount_point).to be_nil
        end
      end
    end

    shared_examples "default required" do |mount_path|
      context "and its mount point is the default one" do
        before do
          subject.mount_path = mount_path
        end

        it "does not modify its mount point" do
          subject.set_default_mount_point

          expect(subject.mount_path).to eq(mount_path)
        end
      end

      context "and its mount point is not the default one" do
        before do
          subject.mount_path = mount_path + "bar"
        end

        it "mounts it at its default mount path" do
          subject.set_default_mount_point

          expect(subject.mount_path).to eq(mount_path)
        end
      end

      context "and it has no mount point" do
        before do
          subject.remove_mount_point
        end

        it "adds its default mount point" do
          subject.set_default_mount_point

          expect(subject.mount_path).to eq(mount_path)
        end
      end
    end

    context "when the subvolume does not belong to the root filesystem" do
      let(:fs_mount_path) { "/foo" }

      let(:subvolume_path) { "@/home" }

      include_examples "default not required"
    end

    context "when the subvolume belongs to the root filesystem" do
      let(:fs_mount_path) { "/" }

      context "and it is the top level subvolume" do
        let(:subvolume_path) { "" }

        it "does not add a mount point" do
          subject.set_default_mount_point

          expect(subject.mount_point).to be_nil
        end
      end

      context "and it is the default subvolume" do
        before do
          subject.set_default_btrfs_subvolume
        end

        let(:subvolume_path) { "@/home" }

        include_examples "default not required"
      end

      context "and it is a snapshot subvolume" do
        before do
          blk_device.filesystem.create_btrfs_subvolume("@/.snapshots/1/snapshot", true)
        end

        let(:subvolume_path) { "@/.snapshots/1/snapshot" }

        include_examples "default not required"
      end

      context "and its parent is neither the top level nor the prefix subvolume" do
        before do
          # This subvolume is created as child of the existing @/tmp.
          blk_device.filesystem.create_btrfs_subvolume("@/tmp/foo", true)
        end

        let(:subvolume_path) { "@/tmp/foo" }

        include_examples "default not required"
      end

      context "and its parent is the top level subvolume" do
        before do
          blk_device.filesystem.mount_path = "/"

          # Note that this subvolume is not considered a subvolume for working with snapshots because
          # it is not under the subvolume prefix (does not start by @).
          blk_device.filesystem.create_btrfs_subvolume(".snapshots", true)
        end

        let(:subvolume_path) { ".snapshots" }

        include_examples "default required", "/.snapshots"
      end

      context "and its parent is the prefix subvolume" do
        let(:subvolume_path) { "@/home" }

        include_examples "default required", "/home"
      end
    end
  end

  describe "#referenced" do
    context "if quotas are not enabled for the Btrfs filesystem" do
      it "returns nil" do
        expect(subvolume.referenced).to be_nil
      end
    end

    context "if quotas are enabled for the filesystem" do
      let(:scenario) { "btrfs_simple_quotas.xml" }
      let(:dev_name) { "/dev/vda2" }

      context "and the subvolume has an associated level 0 qgroup" do
        let(:subvolume_path) { "@/home" }

        it "returns the size of the referenced space" do
          expect(subvolume.referenced).to eq 48.KiB
        end
      end

      context "and the subvolume does not have an associated qgroup" do
        let(:subvolume_path) { "@/opt" }

        it "returns nil" do
          expect(subvolume.referenced).to be_nil
        end
      end
    end
  end

  describe "#exclusive" do
    context "if quotas are not enabled for the Btrfs filesystem" do
      it "returns nil" do
        expect(subvolume.exclusive).to be_nil
      end
    end

    context "if quotas are enabled for the filesystem" do
      let(:scenario) { "btrfs_simple_quotas.xml" }
      let(:dev_name) { "/dev/vda2" }

      context "and the subvolume has an associated level 0 qgroup" do
        let(:subvolume_path) { "@/home" }

        it "returns the size of the exclusive space" do
          expect(subvolume.exclusive).to eq 48.KiB
        end
      end

      context "and the subvolume does not have an associated qgroup" do
        let(:subvolume_path) { "@/opt" }

        it "returns nil" do
          expect(subvolume.exclusive).to be_nil
        end
      end
    end
  end

  describe "#referenced_limit" do
    context "if quotas are not enabled for the Btrfs filesystem" do
      it "returns unlimited" do
        expect(subvolume.referenced_limit).to be_unlimited
      end
    end

    context "if quotas are enabled for the filesystem" do
      let(:scenario) { "btrfs_simple_quotas.xml" }
      let(:dev_name) { "/dev/vda2" }

      context "and the subvolume has an associated qgroup with a referenced limit" do
        let(:subvolume_path) { "@/var" }

        it "returns the size of the referenced limit" do
          expect(subvolume.referenced_limit).to eq 10.GiB
        end
      end

      context "and the subvolume has an associated qgroup with no referenced limit" do
        let(:subvolume_path) { "@/root" }

        it "returns unlimited" do
          expect(subvolume.referenced_limit).to be_unlimited
        end
      end

      context "and the subvolume does not have an associated qgroup" do
        let(:subvolume_path) { "@/opt" }

        it "returns unlimited" do
          expect(subvolume.referenced_limit).to be_unlimited
        end
      end
    end
  end

  describe "#referenced_limit=" do
    context "if quotas are not enabled for the Btrfs filesystem" do
      it "has no effect" do
        expect(subvolume.referenced_limit).to be_unlimited
        subvolume.referenced_limit = 330.MiB
        expect(subvolume.referenced_limit).to be_unlimited
        subvolume.referenced_limit = Y2Storage::DiskSize.unlimited
        expect(subvolume.referenced_limit).to be_unlimited
      end
    end

    context "if quotas are enabled for the filesystem" do
      let(:scenario) { "btrfs_simple_quotas.xml" }
      let(:dev_name) { "/dev/vda2" }

      context "and the subvolume has an associated qgroup with a referenced limit" do
        let(:subvolume_path) { "@/var" }

        it "changes the limit if a size is given" do
          subvolume.referenced_limit = 350.MiB
          expect(subvolume.referenced_limit).to eq 350.MiB
        end

        it "removes the limit if unlimited is given" do
          subvolume.referenced_limit = Y2Storage::DiskSize.unlimited
          expect(subvolume.referenced_limit).to be_unlimited
        end
      end

      context "and the subvolume has an associated qgroup with no referenced limit" do
        let(:subvolume_path) { "@/root" }

        it "sets a new limit if a size is given" do
          expect(subvolume.referenced_limit).to be_unlimited
          subvolume.referenced_limit = 400.MiB
          expect(subvolume.referenced_limit).to eq 400.MiB
        end

        it "does not set any limit if unlimited is given" do
          subvolume.referenced_limit = Y2Storage::DiskSize.unlimited
          expect(subvolume.referenced_limit).to be_unlimited
        end
      end

      context "and the subvolume does not have an associated qgroup" do
        let(:subvolume_path) { "@/opt" }

        it "sets a new limit if a size is given" do
          expect(subvolume.referenced_limit).to be_unlimited
          subvolume.referenced_limit = 400.MiB
          expect(subvolume.referenced_limit).to eq 400.MiB
        end

        it "does not set any limit if unlimited is given" do
          subvolume.referenced_limit = Y2Storage::DiskSize.unlimited
          expect(subvolume.referenced_limit).to be_unlimited
        end
      end
    end
  end

  describe "#exclusive_limit" do
    context "if quotas are not enabled for the Btrfs filesystem" do
      it "returns unlimited" do
        expect(subvolume.exclusive_limit).to be_unlimited
      end
    end

    context "if quotas are enabled for the filesystem" do
      let(:scenario) { "btrfs_simple_quotas.xml" }
      let(:dev_name) { "/dev/vda2" }

      context "and the subvolume has an associated qgroup with a exclusive limit" do
        let(:subvolume_path) { "@/srv" }

        it "returns the size of the exclusive limit" do
          expect(subvolume.exclusive_limit).to eq 2.5.GiB
        end
      end

      context "and the subvolume has an associated qgroup with no exclusive limit" do
        let(:subvolume_path) { "@/var" }

        it "returns unlimited" do
          expect(subvolume.exclusive_limit).to be_unlimited
        end
      end

      context "and the subvolume does not have an associated qgroup" do
        let(:subvolume_path) { "@/opt" }

        it "returns unlimited" do
          expect(subvolume.exclusive_limit).to be_unlimited
        end
      end
    end
  end

  describe "#exclusive_limit=" do
    context "if quotas are not enabled for the Btrfs filesystem" do
      it "has no effect" do
        expect(subvolume.exclusive_limit).to be_unlimited
        subvolume.exclusive_limit = 330.MiB
        expect(subvolume.exclusive_limit).to be_unlimited
        subvolume.exclusive_limit = Y2Storage::DiskSize.unlimited
        expect(subvolume.exclusive_limit).to be_unlimited
      end
    end

    context "if quotas are enabled for the filesystem" do
      let(:scenario) { "btrfs_simple_quotas.xml" }
      let(:dev_name) { "/dev/vda2" }

      context "and the subvolume has an associated qgroup with a exclusive limit" do
        let(:subvolume_path) { "@/srv" }

        it "changes the limit if a size is given" do
          subvolume.exclusive_limit = 350.MiB
          expect(subvolume.exclusive_limit).to eq 350.MiB
        end

        it "removes the limit if unlimited is given" do
          subvolume.exclusive_limit = Y2Storage::DiskSize.unlimited
          expect(subvolume.exclusive_limit).to be_unlimited
        end
      end

      context "and the subvolume has an associated qgroup with no exclusive limit" do
        let(:subvolume_path) { "@/var" }

        it "sets a new limit if a size is given" do
          expect(subvolume.exclusive_limit).to be_unlimited
          subvolume.exclusive_limit = 400.MiB
          expect(subvolume.exclusive_limit).to eq 400.MiB
        end

        it "does not set any limit if unlimited is given" do
          subvolume.exclusive_limit = Y2Storage::DiskSize.unlimited
          expect(subvolume.exclusive_limit).to be_unlimited
        end
      end

      context "and the subvolume does not have an associated qgroup" do
        let(:subvolume_path) { "@/opt" }

        it "sets a new limit if a size is given" do
          expect(subvolume.exclusive_limit).to be_unlimited
          subvolume.exclusive_limit = 400.MiB
          expect(subvolume.exclusive_limit).to eq 400.MiB
        end

        it "does not set any limit if unlimited is given" do
          subvolume.exclusive_limit = Y2Storage::DiskSize.unlimited
          expect(subvolume.exclusive_limit).to be_unlimited
        end
      end
    end
  end

  describe "prefix?" do
    before do
      blk_device.filesystem.subvolumes_prefix = prefix
    end

    context "when the subvolume is used as prefix" do
      let(:prefix) { subvolume_path }

      it "returns true" do
        expect(subject.prefix?).to eq(true)
      end
    end

    context "when the subvolume is not used as prefix" do
      let(:prefix) { "foo" }

      it "returns false" do
        expect(subject.prefix?).to eq(false)
      end
    end
  end
end
