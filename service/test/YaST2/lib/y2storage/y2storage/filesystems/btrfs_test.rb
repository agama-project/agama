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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"

require "y2storage"

describe Y2Storage::Filesystems::Btrfs do
  include_context "yast2-storage-ng test setup"

  before do
    allow(Y2Storage::VolumeSpecification).to receive(:for).with("/").and_return(root_spec)

    fake_scenario(scenario)
  end

  let(:root_spec) { instance_double(Y2Storage::VolumeSpecification, btrfs_default_subvolume: "@") }

  let(:scenario) { "mixed_disks_btrfs" }

  let(:blk_device) { Y2Storage::BlkDevice.find_by_name(devicegraph, dev_name) }

  let(:dev_name) { "/dev/sda2" }

  subject(:filesystem) { blk_device.blk_filesystem }

  let(:devicegraph) { Y2Storage::StorageManager.instance.staging }

  describe "#btrfs_subvolumes?" do
    context "when the filesystem has subvolumes" do
      it "returns true" do
        expect(subject.btrfs_subvolumes?).to eq(true)
      end
    end

    context "when the filesytem only has a top level subvolume" do
      before do
        subject.top_level_btrfs_subvolume.remove_descendants
      end

      it "returns false" do
        expect(subject.btrfs_subvolumes?).to eq(false)
      end
    end

    context "when the filesytem has no subvolumes" do
      before do
        subject.remove_descendants
      end

      it "returns false" do
        expect(subject.btrfs_subvolumes?).to eq(false)
      end
    end
  end

  describe "#btrfs_subvolumes" do
    it "returns an array of BtrfsSubvolume objects" do
      expect(filesystem.btrfs_subvolumes).to be_a Array
      expect(filesystem.btrfs_subvolumes).to all(be_a(Y2Storage::BtrfsSubvolume))
    end
  end

  describe "#top_level_btrfs_subvolume" do
    it "returns a subvolume with 5 as id" do
      expect(filesystem.top_level_btrfs_subvolume).to be_a Y2Storage::BtrfsSubvolume
      expect(filesystem.top_level_btrfs_subvolume.id).to eq 5

    end
  end

  describe "#default_btrfs_subvolume" do
    it "returns a BtrfsSubvolume object" do
      expect(filesystem.default_btrfs_subvolume).to be_a(Y2Storage::BtrfsSubvolume)
    end

    it "returns the default subvolume" do
      expect(filesystem.default_btrfs_subvolume.path).to eq("@")
    end
  end

  describe "#find_btrfs_subvolume_by_path" do
    context "when exists a subvolume with the searched path" do
      it "returns the subvolume with that path" do
        path = "@/home"
        subvolume = filesystem.find_btrfs_subvolume_by_path(path)

        expect(subvolume).to be_a(Y2Storage::BtrfsSubvolume)
        expect(subvolume.path).to eq(path)
      end
    end

    context "when does not exist a subvolume with the searched path" do
      it "returns nil" do
        expect(filesystem.find_btrfs_subvolume_by_path("@/foo")).to be_nil
      end
    end
  end

  describe "#ensure_default_btrfs_subvolume" do
    let(:sda2) { "/dev/sda2" } # default is @
    let(:sdb2) { "/dev/sdb2" } # default is top level

    context "when the requested default path is nil" do
      let(:dev_name) { sda2 }
      let(:path) { nil }

      it "does not create a new subvolume" do
        subvolumes = filesystem.btrfs_subvolumes
        filesystem.ensure_default_btrfs_subvolume(path: path)

        expect(filesystem.btrfs_subvolumes.map(&:path) - subvolumes.map(&:path)).to be_empty
      end

      it "returns the current default subvolume" do
        default = filesystem.default_btrfs_subvolume
        subvolume = filesystem.ensure_default_btrfs_subvolume(path: path)

        expect(subvolume).to eq(default)
      end
    end

    context "when the requested default path is the top level subvolume path" do
      let(:dev_name) { sda2 }
      let(:path) { filesystem.top_level_btrfs_subvolume.path }

      it "does not create a new subvolume" do
        subvolumes = filesystem.btrfs_subvolumes
        filesystem.ensure_default_btrfs_subvolume(path: path)

        expect(filesystem.btrfs_subvolumes.map(&:path) - subvolumes.map(&:path)).to be_empty
      end

      it "returns the top level subvolume" do
        subvolume = filesystem.ensure_default_btrfs_subvolume(path: path)
        expect(subvolume.top_level?).to be(true)
      end

      it "sets the top level subvolume as default subvolume" do
        expect(filesystem.top_level_btrfs_subvolume.default_btrfs_subvolume?).to eq(false)

        filesystem.ensure_default_btrfs_subvolume(path: path)

        expect(filesystem.top_level_btrfs_subvolume.default_btrfs_subvolume?).to eq(true)
      end
    end

    context "when the requested default path does not exist" do
      let(:dev_name) { "/dev/sdb3" }
      let(:path) { "@" }

      it "creates a new default subvolume with the requested path" do
        expect(filesystem.btrfs_subvolumes.map(&:path)).to_not include(path)

        subvolume = filesystem.ensure_default_btrfs_subvolume(path: path)

        expect(subvolume.default_btrfs_subvolume?).to be(true)
        expect(subvolume.path).to eq(path)
      end
    end

    context "when the requested default path already exists" do
      let(:dev_name) { sda2 }
      let(:path) { "@/home" }

      it "does not create a new subvolume" do
        subvolumes = filesystem.btrfs_subvolumes
        filesystem.ensure_default_btrfs_subvolume(path: path)

        expect(filesystem.btrfs_subvolumes.map(&:path) - subvolumes.map(&:path)).to be_empty
      end

      it "returns the subvolume with the requested path" do
        subvolume = filesystem.ensure_default_btrfs_subvolume(path: path)
        expect(subvolume.path).to eq(path)
      end

      it "sets the subvolume as default subvolume" do
        expect(filesystem.find_btrfs_subvolume_by_path(path).default_btrfs_subvolume?).to eq(false)

        filesystem.ensure_default_btrfs_subvolume(path: path)

        expect(filesystem.find_btrfs_subvolume_by_path(path).default_btrfs_subvolume?).to eq(true)
      end
    end
  end

  describe "#delete_btrfs_subvolume" do
    before do
      subject.subvolumes_prefix = "@"

      subject.find_btrfs_subvolume_by_path("@").remove_descendants

      subvolumes.map { |s| subject.create_btrfs_subvolume(s, false) }
    end

    let(:subvolumes) { ["@/home"] }

    context "when the filesystem has a subvolume with the indicated path" do
      let(:path) { "@/home" }

      it "deletes the subvolume" do
        expect(filesystem.btrfs_subvolumes).to include(an_object_having_attributes(path: path))
        filesystem.delete_btrfs_subvolume(path)
        expect(filesystem.btrfs_subvolumes).to_not include(an_object_having_attributes(path: path))
      end

      context "when there are no more subvolumes after deleting" do
        let(:path) { "@/home" }

        it "does not reset the subvolumes prefix" do
          filesystem.delete_btrfs_subvolume(path)

          expect(filesystem.subvolumes_prefix).to eq("@")
        end
      end

      context "when there are no more subvolumes after deleting" do
        let(:path) { "@" }

        it "resets the subvolumes prefix" do
          filesystem.delete_btrfs_subvolume(path)

          expect(filesystem.subvolumes_prefix).to eq("")
        end
      end
    end

    context "when the filesystem does not have a subvolume with the indicated path" do
      let(:path) { "@/foo" }

      it "does not delete any subvolume" do
        subvolumes_before = filesystem.btrfs_subvolumes
        filesystem.delete_btrfs_subvolume(path)
        expect(filesystem.btrfs_subvolumes).to eq(subvolumes_before)
      end

      it "does not reset the subvolumes prefix" do
        filesystem.delete_btrfs_subvolume(path)

        expect(filesystem.subvolumes_prefix).to eq("@")
      end
    end

    context "when the default subvolume path is given" do
      let(:path) { "@" }

      it "removes the default subvolume" do
        filesystem.delete_btrfs_subvolume(path)

        expect(filesystem.btrfs_subvolumes).to_not include(an_object_having_attributes(path: "@"))
      end

      it "sets top level subvolume as default subvolume" do
        filesystem.delete_btrfs_subvolume(path)

        expect(filesystem.top_level_btrfs_subvolume).to eq(filesystem.default_btrfs_subvolume)
      end
    end

    context "when the top level subvolume path is given" do
      let(:path) { "" }

      it "does not delete any subvolume" do
        subvolumes_before = filesystem.btrfs_subvolumes
        filesystem.delete_btrfs_subvolume(path)
        expect(filesystem.btrfs_subvolumes).to eq(subvolumes_before)
      end

      it "does not reset the subvolumes prefix" do
        filesystem.delete_btrfs_subvolume(path)

        expect(filesystem.subvolumes_prefix).to eq("@")
      end
    end
  end

  describe "#create_btrfs_subvolume" do
    let(:devicegraph) { Y2Storage::StorageManager.instance.staging }

    let(:path1) { "@/foo" }
    let(:path2) { "@/foo/bar/baz" }
    let(:path3) { "@/foo/bar" }
    let(:nocow) { true }

    it "creates a new subvolume" do
      expect(filesystem.btrfs_subvolumes.map(&:path)).to_not include(path1)
      filesystem.create_btrfs_subvolume(path1, nocow)
      expect(filesystem.btrfs_subvolumes.map(&:path)).to include(path1)
    end

    it "returns the new created subvolume" do
      subvolume = filesystem.create_btrfs_subvolume(path1, nocow)
      expect(subvolume).to be_a(Y2Storage::BtrfsSubvolume)
      expect(subvolume.path).to eq(path1)
      expect(subvolume.nocow?).to eq(nocow)
    end

    context "when a default mount point is necessary for the new subvolume" do
      before do
        filesystem.mount_path = "/"
      end

      it "creates the subvolume with the default mount point" do
        subvolume = filesystem.create_btrfs_subvolume(path1, nocow)
        expect(subvolume.mount_path).to eq(path1.delete("@"))
      end
    end

    context "when a default mount point is not necessary for the new subvolume" do
      before do
        filesystem.mount_path = "/foo"
      end

      it "creates the subvolume without a mount point" do
        subvolume = filesystem.create_btrfs_subvolume(path1, nocow)
        expect(subvolume.mount_path).to be_nil
      end
    end

    context "when the filesystem is going to be formatted" do
      before do
        allow(filesystem).to receive(:exists_in_raw_probed?).and_return(false)
      end

      it "can insert a subvolume into an existing hierarchy" do
        filesystem.create_btrfs_subvolume(path2, nocow)
        filesystem.create_btrfs_subvolume(path3, nocow)
        expect(filesystem.btrfs_subvolumes.map(&:path)).to include(path3)
      end
    end

    context "when the filesystem already exists" do
      before do
        allow(filesystem).to receive(:exists_in_raw_probed?).and_return(true)
      end

      context "and the subvolume does not fit in the existing hierarchy" do
        before do
          filesystem.create_btrfs_subvolume(path2, nocow)
        end

        it "can not create a subvolume" do
          filesystem.create_btrfs_subvolume(path3, nocow)
          expect(filesystem.btrfs_subvolumes.map(&:path)).to_not include(path3)
        end

        it "and returns nil" do
          expect(filesystem.create_btrfs_subvolume(path3, nocow)).to be_nil
        end
      end
    end
  end

  describe "#canonical_subvolume_name" do
    it "converts subvolume name into the canonical form" do
      expect(filesystem.canonical_subvolume_name("foo")).to eq "foo"
      expect(filesystem.canonical_subvolume_name("/foo")).to eq "foo"
      expect(filesystem.canonical_subvolume_name("foo/bar")).to eq "foo/bar"
      expect(filesystem.canonical_subvolume_name("foo//bar////xxx//")).to eq "foo/bar/xxx"
      expect(filesystem.canonical_subvolume_name("///")).to eq ""
      expect(filesystem.canonical_subvolume_name("/")).to eq ""
      expect(filesystem.canonical_subvolume_name("")).to eq ""
    end
  end

  describe "#subvolume_descendants" do
    let(:devicegraph) { Y2Storage::StorageManager.instance.staging }

    let(:path1) { "@/foo" }
    let(:path2) { "@/foo/bar" }

    it "returns a list of descendant subvolumes" do
      filesystem.create_btrfs_subvolume(path1, false)
      filesystem.create_btrfs_subvolume(path2, false)
      subvolumes = filesystem.subvolume_descendants(path1)
      expect(subvolumes).to be_a Array
      expect(subvolumes).to all(be_a(Y2Storage::BtrfsSubvolume))
      expect(subvolumes.first.path).to eq path2
    end
  end

  describe "#subvolume_can_be_created?" do
    let(:devicegraph) { Y2Storage::StorageManager.instance.staging }

    let(:path1) { "@/foo" }
    let(:path2) { "@/foo/bar" }

    context "when the filesystem is going to be formatted" do
      before do
        allow(filesystem).to receive(:exists_in_raw_probed?).and_return(false)
      end

      context "and a subvolume must be inserted into an existing hierarchy" do
        it "returns true" do
          filesystem.create_btrfs_subvolume(path2, false)
          expect(filesystem.subvolume_can_be_created?(path1)).to be(true)
        end
      end

      context "and a subvolume must not be inserted into an existing hierarchy" do
        it "returns true" do
          filesystem.create_btrfs_subvolume(path1, false)
          expect(filesystem.subvolume_can_be_created?(path2)).to be(true)
        end
      end
    end

    context "when the filesystem already exists" do
      before do
        allow(filesystem).to receive(:exists_in_raw_probed?).and_return(true)
      end

      context "and a subvolume must be inserted into an existing hierarchy" do
        it "returns false" do
          filesystem.create_btrfs_subvolume(path2, false)
          expect(filesystem.subvolume_can_be_created?(path1)).to be(false)
        end
      end

      context "and a subvolume must not be inserted into an existing hierarchy" do
        it "returns true" do
          filesystem.create_btrfs_subvolume(path1, false)
          expect(filesystem.subvolume_can_be_created?(path2)).to be(true)
        end
      end
    end
  end

  describe "#add_btrfs_subvolumes" do
    let(:specs) { [spec1, spec2] }

    context "when subvolumes for the indicated specs do not exist" do
      let(:spec1) { Y2Storage::SubvolSpecification.new("foo") }
      let(:spec2) { Y2Storage::SubvolSpecification.new("bar") }

      it "creates the subvolumes indicated in specs" do
        expect(filesystem.find_btrfs_subvolume_by_path("@/foo")).to be_nil
        expect(filesystem.find_btrfs_subvolume_by_path("@/bar")).to be_nil

        filesystem.add_btrfs_subvolumes(specs)

        expect(filesystem.find_btrfs_subvolume_by_path("@/foo")).to_not be_nil
        expect(filesystem.find_btrfs_subvolume_by_path("@/bar")).to_not be_nil
      end

      it "creates new subvolumes as 'can be auto deleted'" do
        filesystem.add_btrfs_subvolumes(specs)
        expect(filesystem.find_btrfs_subvolume_by_path("@/foo").can_be_auto_deleted?).to eq(true)
        expect(filesystem.find_btrfs_subvolume_by_path("@/bar").can_be_auto_deleted?).to eq(true)
      end

      it "does not set the existing subvolumes as 'can be deleted'" do
        filesystem.add_btrfs_subvolumes(specs)
        expect(filesystem.find_btrfs_subvolume_by_path("@/home").can_be_auto_deleted?).to eq(false)
      end
    end

    context "when a subvolume already exists" do
      let(:spec1) { Y2Storage::SubvolSpecification.new("foo") }
      let(:spec2) { Y2Storage::SubvolSpecification.new("home") }

      it "does not create the subvolume again" do
        home_subvolume = filesystem.find_btrfs_subvolume_by_path("@/home")
        filesystem.add_btrfs_subvolumes(specs)
        home_subvolumes = filesystem.btrfs_subvolumes.select { |s| s.path == "@/home" }

        expect(home_subvolumes.size).to eq(1)
        expect(home_subvolume).to eq(home_subvolumes.first)
      end
    end

    context "when a subvolume spec is not for the current arch" do
      let(:architecture) { :x86_64 }
      let(:spec1) { Y2Storage::SubvolSpecification.new("foo") }
      let(:spec2) { Y2Storage::SubvolSpecification.new("bar", archs: ["s390"]) }

      it "does not create the subvolume for other archs" do
        filesystem.add_btrfs_subvolumes(specs)
        expect(filesystem.find_btrfs_subvolume_by_path("@/bar")).to be_nil
      end
    end
  end

  describe "#btrfs_subvolume_path" do
    let(:dev_name) { "/dev/sda2" }

    context "when the subvolumes prefix is not empty" do
      before do
        filesystem.subvolumes_prefix = "@"
      end

      context "and the path starts with the subvolumes prefix" do
        let(:path) { "@/foo" }

        it "returns the path" do
          expect(filesystem.btrfs_subvolume_path(path)).to eq(path)
        end
      end

      context "and the path is an absolute path" do
        let(:path) { "/foo" }

        it "returns a fixed path starting with the subvolumes prefix" do
          expect(filesystem.btrfs_subvolume_path(path)).to eq("@/foo")
        end
      end

      context "and the path is a relative path" do
        let(:path) { "foo" }

        it "returns a fixed path starting with the subvolumes prefix" do
          expect(filesystem.btrfs_subvolume_path(path)).to eq("@/foo")
        end
      end
    end

    context "when the subvolumes prefix is empty" do
      before do
        filesystem.subvolumes_prefix = ""
      end

      context "and the path is an absolute path" do
        let(:path) { "/foo" }

        it "returns a fixed relative path without any prefix" do
          expect(filesystem.btrfs_subvolume_path(path)).to eq("foo")
        end
      end

      context "and the path is a relative path" do
        let(:path) { "foo" }

        it "returns the path" do
          expect(filesystem.btrfs_subvolume_path(path)).to eq("foo")
        end
      end
    end
  end

  describe "#btrfs_subvolume_mount_point" do
    before do
      allow(filesystem).to receive(:mount_path).and_return(mount_path)
    end

    context "when the filesystem is not mounted" do
      let(:mount_path) { nil }

      it "returns nil" do
        expect(filesystem.btrfs_subvolume_mount_point("@/foo")).to be_nil
      end
    end

    context "when the filesystem is mounted" do
      let(:mount_path) { "/var" }

      it "returns the subvolume mount point for the indicated path" do
        expect(filesystem.btrfs_subvolume_mount_point("@/foo")).to eq("/var/foo")
      end
    end
  end

  describe ".btrfs_subvolume_path" do
    let(:default_subvolume_path) { "@" }
    let(:path) { "foo" }

    it "creates a subvolume path" do
      expect(described_class.btrfs_subvolume_path(default_subvolume_path, path)).to eq("@/foo")
    end

    context "when the default subvolume path is nil" do
      let(:default_subvolume_path) { nil }

      it "returns nil" do
        expect(described_class.btrfs_subvolume_path(default_subvolume_path, path)).to be(nil)
      end
    end

    context "when the subvolume path is nil" do
      let(:path) { nil }

      it "returns nil" do
        expect(described_class.btrfs_subvolume_path(default_subvolume_path, path)).to be(nil)
      end
    end
  end

  describe ".btrfs_subvolume_mount_point" do
    let(:path) { "bar" }

    context "when the filesystem is not mounted" do
      let(:mount_path) { nil }

      it "returns nil" do
        expect(described_class.btrfs_subvolume_mount_point(mount_path, path)).to be_nil
      end
    end

    context "when the subvolume path is nil" do
      let(:mount_path) { "/" }
      let(:path) { nil }

      it "returns nil" do
        expect(described_class.btrfs_subvolume_mount_point(mount_path, path)).to be(nil)
      end
    end

    context "when the filesystem is mounted" do
      let(:mount_path) { "/foo" }

      it "returns the subvolume mount point for the indicated path" do
        expect(described_class.btrfs_subvolume_mount_point(mount_path, path)).to eq("/foo/bar")
      end
    end
  end

  describe "#auto_deleted_subvolumes" do
    let(:subvol1) { Y2Storage::SubvolSpecification.new("path1") }
    let(:subvol2) { Y2Storage::SubvolSpecification.new("path2", copy_on_write: false) }

    it "returns an empty array by default" do
      expect(filesystem.auto_deleted_subvolumes).to eq []
    end

    it "allows to store a list of SubvolSpecification objects" do
      filesystem.auto_deleted_subvolumes = [subvol1, subvol2]

      expect(filesystem.auto_deleted_subvolumes).to all(be_a(Y2Storage::SubvolSpecification))
      expect(filesystem.auto_deleted_subvolumes).to contain_exactly(
        an_object_having_attributes(path: "path1", copy_on_write: true),
        an_object_having_attributes(path: "path2", copy_on_write: false)
      )
    end

    it "returns a copy of the stored objects instead of the original ones" do
      subvols = [subvol1, subvol2]
      filesystem.auto_deleted_subvolumes = subvols
      returned_subvols = filesystem.auto_deleted_subvolumes

      expect(returned_subvols).to_not equal subvols
      expect(returned_subvols[0]).to_not equal subvols[0]
      expect(returned_subvols[1]).to_not equal subvols[1]
    end

    it "shares the stored value with all the instances of the filesystem" do
      filesystem.auto_deleted_subvolumes = [subvol1, subvol2]

      another = Y2Storage::BlkDevice.find_by_name(devicegraph, dev_name).filesystem
      expect(another.auto_deleted_subvolumes).to contain_exactly(
        an_object_having_attributes(path: "path1", copy_on_write: true),
        an_object_having_attributes(path: "path2", copy_on_write: false)
      )
    end

    it "gets copied when the devicegraph is cloned" do
      filesystem.auto_deleted_subvolumes = [subvol1, subvol2]
      new_graph = devicegraph.dup

      another = Y2Storage::BlkDevice.find_by_name(new_graph, dev_name).filesystem
      expect(another.auto_deleted_subvolumes).to contain_exactly(
        an_object_having_attributes(path: "path1", copy_on_write: true),
        an_object_having_attributes(path: "path2", copy_on_write: false)
      )
    end
  end

  describe "#subvolumes_prefix" do
    let(:dev_name) { "/dev/sda2" }

    shared_examples "candidate paths" do
      context "and the path of the subvolume is '@'" do
        let(:subvol) { "@" }

        it "returns '@'" do
          expect(filesystem.subvolumes_prefix).to eq("@")
        end
      end

      context "and the path of the subvolume is not '@'" do
        let(:subvol) { "foo" }

        context "and there is a default subvolume in the control file for the filesystem" do
          let(:root_spec) do
            instance_double(Y2Storage::VolumeSpecification, btrfs_default_subvolume: spec_default)
          end

          context "and the path of the subvolume is equal to the control file value" do
            let(:spec_default) { "foo" }

            it "returns the path of the subvolume" do
              expect(filesystem.subvolumes_prefix).to eq("foo")
            end
          end

          context "and the path of the subvolume is not equal to the control file value" do
            let(:spec_default) { "@" }

            it "returns an empty string" do
              expect(filesystem.subvolumes_prefix).to be_empty
            end
          end
        end

        context "and there is not a default subvolume in the control file for the filesystem" do
          let(:root_spec) { nil }

          it "returns an empty string" do
            expect(filesystem.subvolumes_prefix).to be_empty
          end
        end
      end
    end

    context "when it was explicitly set" do
      before do
        filesystem.subvolumes_prefix = "foo"
      end

      it "returns the value" do
        expect(filesystem.subvolumes_prefix).to eq("foo")
      end
    end

    context "when it has not been set yet" do
      before do
        subject.subvolumes_prefix = nil
      end

      context "when the filesystem only contains a top level subvolume" do
        before do
          filesystem.top_level_btrfs_subvolume.remove_descendants
        end

        it "returns an empty string" do
          expect(filesystem.subvolumes_prefix).to be_empty
        end
      end

      context "when the filesystem contains subvolumes" do
        before do
          filesystem.top_level_btrfs_subvolume.remove_descendants

          top_level_children.each do |path|
            filesystem.top_level_btrfs_subvolume.create_btrfs_subvolume(path)
          end
        end

        context "and the top level subvolume has several child subvolumes" do
          let(:top_level_children) { ["@", "foo"] }

          it "returns an empty string" do
            expect(filesystem.subvolumes_prefix).to be_empty
          end
        end

        context "and the top level subvolume only has one child subvolume" do
          let(:top_level_children) { [subvol] }

          before do
            subvol = filesystem.top_level_btrfs_subvolume.children.first

            subvol_children.each do |path|
              subvol.create_btrfs_subvolume(path)
            end
          end

          context "and the subvolume has no children" do
            let(:subvol_children) { [] }

            include_examples "candidate paths"
          end

          context "and the subvolume has children" do
            let(:subvol_children) { [child1, child2] }

            context "and the paths of all the children start with the subvolume path" do
              let(:child1) { subvol + "/home" }

              let(:child2) { subvol + "/var" }

              include_examples "candidate paths"
            end

            context "and the paths of some children do not start with the subvolume path" do
              let(:subvol) { "@" }

              let(:child1) { "@/home" }

              let(:child2) { "var" }

              it "returns an empty string" do
                expect(filesystem.subvolumes_prefix).to be_empty
              end
            end
          end
        end
      end
    end
  end

  describe "#snapshots?" do
    let(:subvolumes_prefix) { "@" }

    before do
      allow(subject).to receive(:btrfs_subvolumes).and_return(subvolumes)
      allow(subject).to receive(:subvolumes_prefix).and_return(subvolumes_prefix)
    end

    context "when a subvolume for snapshots exists" do
      let(:subvolumes) do
        [
          instance_double(Y2Storage::BtrfsSubvolume, path: "@"),
          instance_double(Y2Storage::BtrfsSubvolume, path: "@/.snapshots")
        ]
      end

      it "returns true" do
        expect(subject.snapshots?).to eq(true)
      end
    end

    context "when no subvolume for snapshots exists" do
      let(:subvolumes) do
        [
          instance_double(Y2Storage::BtrfsSubvolume, path: "@"),
          instance_double(Y2Storage::BtrfsSubvolume, path: "@/srv")
        ]
      end

      it "returns false" do
        expect(subject.snapshots?).to eq(false)
      end

      context "but snapper will be configured" do
        before do
          allow(subject).to receive(:configure_snapper).and_return(true)
        end

        it "returns true" do
          expect(subject.snapshots?).to eq(true)
        end
      end
    end

    context "when subvolume prefix is empty" do
      let(:subvolumes_prefix) { "" }

      context "and a subvolume for snapshots exists" do
        let(:subvolumes) do
          [
            instance_double(Y2Storage::BtrfsSubvolume, path: ""),
            instance_double(Y2Storage::BtrfsSubvolume, path: ".snapshots")
          ]
        end

        it "returns true" do
          expect(subject.snapshots?).to eq(true)
        end
      end
    end
  end

  describe "#copy_mount_by_to_subvolumes" do
    def subvol_mount_bys(btrfs)
      subvol_mount_points = btrfs.btrfs_subvolumes.reject { |s| s.mount_point.nil? }
      subvol_mount_points.map { |m| m.mount_by.to_sym }
    end

    it "copies the btrfs mount_by value to all subvolumes" do
      filesystem.mount_point.assign_mount_by(Y2Storage::Filesystems::MountByType::UUID)

      expect(filesystem.mount_by.to_sym).to eq :uuid
      expect(subvol_mount_bys(filesystem)).to all(eq :label)

      filesystem.copy_mount_by_to_subvolumes

      expect(filesystem.mount_by.to_sym).to eq :uuid
      expect(subvol_mount_bys(filesystem)).to all(eq :uuid)
    end
  end

  describe "#quota=" do
    context "on a filesystem that had no quota support originally" do
      it "enables support and creates the necessary qgroups when true is given" do
        expect(subject.quota?).to eq false
        expect(subject.btrfs_qgroups).to be_empty
        subvols = subject.btrfs_subvolumes.size

        subject.quota = true

        expect(subject.quota?).to eq true
        expect(subject.btrfs_qgroups).to_not be_empty
        expect(subject.btrfs_qgroups.size).to eq subvols
      end

      it "has no effect when false is given" do
        expect(subject.quota?).to eq false
        expect(subject.btrfs_qgroups).to be_empty

        subject.quota = false

        expect(subject.quota?).to eq false
        expect(subject.btrfs_qgroups).to be_empty
      end
    end

    context "on a filesystem which already supports quotas" do
      let(:scenario) { "btrfs_simple_quotas.xml" }
      let(:dev_name) { "/dev/vda2" }

      it "has no effect when true is given" do
        expect(subject.quota?).to eq true
        qgroups = subject.btrfs_qgroups
        expect(qgroups).to_not be_empty

        subject.quota = true

        expect(subject.quota?).to eq true
        expect(subject.btrfs_qgroups).to contain_exactly(*qgroups)
      end

      it "disables support and removes the qgroups when false is given" do
        expect(subject.quota?).to eq true
        expect(subject.btrfs_qgroups).to_not be_empty

        subject.quota = false

        expect(subject.quota?).to eq false
        expect(subject.btrfs_qgroups).to be_empty
      end

      context "if quotas were previously disabled" do
        before do
          @qgroups_sids = subject.btrfs_qgroups.map(&:sid)
          subject.quota = false
        end

        it "re-enables support and restores the qgroups when true is given" do
          expect(subject.quota?).to eq false
          expect(subject.btrfs_qgroups).to be_empty

          subject.quota = true

          expect(subject.quota?).to eq true
          expect(subject.btrfs_qgroups).to_not be_empty
          expect(subject.btrfs_qgroups.map(&:sid)).to contain_exactly(*@qgroups_sids)
        end
      end
    end
  end

  describe "#setup_default_btrfs_subvolumes" do
    before do
      subject.btrfs_subvolumes.map(&:path).each { |p| subject.delete_btrfs_subvolume(p) }

      subject.create_btrfs_subvolume("foo", false)
    end

    let(:spec) do
      instance_double(Y2Storage::VolumeSpecification,
        btrfs_default_subvolume: "@",
        subvolumes:              [
          Y2Storage::SubvolSpecification.new("home"),
          Y2Storage::SubvolSpecification.new("var")
        ])
    end

    context "when there is a volume specification for the filesystem" do
      let(:root_spec) { spec }

      it "creates the subvolumes according to the volume specification" do
        subject.setup_default_btrfs_subvolumes

        paths = subject.btrfs_subvolumes.map(&:path)
        expect(paths).to contain_exactly("", "@", "@/home", "@/var", "foo")
      end

      it "sets the default subvolume according to the volume specification" do
        subject.setup_default_btrfs_subvolumes

        expect(subject.default_btrfs_subvolume.path).to eq("@")
      end
    end

    context "when there is not a volume specification for the filesystem" do
      let(:root_spec) { nil }

      it "does not modify the current default subvolume" do
        subject.setup_default_btrfs_subvolumes

        expect(subject.default_btrfs_subvolume).to eq(subject.top_level_btrfs_subvolume)
      end

      it "does not add subvolumes" do
        subject.setup_default_btrfs_subvolumes

        paths = subject.btrfs_subvolumes.map(&:path)
        expect(paths).to contain_exactly("", "foo")
      end
    end
  end
end
