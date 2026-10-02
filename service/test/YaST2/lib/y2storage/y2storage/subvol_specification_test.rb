#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017] SUSE LLC
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

Yast.import "Arch"

describe Y2Storage::SubvolSpecification do
  include_context "yast2-storage-ng test setup"

  let(:architecture) { :x86_64 }

  subject { Y2Storage::SubvolSpecification.new(path, archs: archs) }

  let(:path) { "" }
  let(:archs) { [] }

  describe ".create_from_btrfs_subvolume" do
    before do
      fake_scenario("mixed_disks_btrfs")
    end

    let(:blk_device) { Y2Storage::BlkDevice.find_by_name(fake_devicegraph, "/dev/sdb2") }
    let(:subvolume) { blk_device.filesystem.create_btrfs_subvolume("/tmp", true) }

    it "returns a new SubvolSpecification with path and copy_on_write from real subvolume" do
      subvol_spec = Y2Storage::SubvolSpecification.create_from_btrfs_subvolume(subvolume)
      expect(subvol_spec.path).to eq("tmp")
      expect(subvol_spec.copy_on_write).to eq(false)
    end
  end

  describe ".create_from_xml" do
    it "returns a subvolume specification with the given path" do
      subvol_spec = described_class.create_from_xml("path" => "/srv")
      expect(subvol_spec.path).to eq("/srv")
    end

    it "sets the list of architectures" do
      subvol_spec = described_class.create_from_xml("path" => "/srv", "archs" => "x86,aarch64")
      expect(subvol_spec.archs).to eq(["x86", "aarch64"])
    end

    context "when a string is given" do
      it "is used as the subvolume path" do
        subvol_spec = described_class.create_from_xml("/srv")
        expect(subvol_spec.path).to eq("/srv")
      end
    end

    context "when 'nil' is given" do
      it "returns nil" do
        expect(described_class.create_from_xml(nil)).to be_nil
      end
    end

    context "when no 'path' is specified" do
      it "returns nil" do
        expect(described_class.create_from_xml({})).to be_nil
      end
    end
  end

  describe "#current_arch?" do

    context "when 'archs' is an empty array" do
      let(:archs) { [] }

      it "returns false" do
        expect(subject.current_arch?).to be(false)
      end
    end

    context "when 'archs' is nil" do
      let(:archs) { nil }

      it "returns true" do
        expect(subject.current_arch?).to be(true)
      end
    end

    context "when 'archs' contains just one name" do
      let(:archs) { ["x86_64"] }

      context "and the current architecture matches the name" do
        let(:architecture) { :x86_64 }

        it "returns true" do
          expect(subject.current_arch?).to be(true)
        end
      end

      context "and the current architecture does not match the name" do
        let(:architecture) { :s390 }

        it "returns false" do
          expect(subject.current_arch?).to be(false)
        end
      end
    end

    context "when 'archs' contains just one name preceded by '!'" do
      let(:archs) { ["!x86_64"] }

      context "and the current architecture matches the name" do
        let(:architecture) { :x86_64 }

        it "returns false" do
          expect(subject.current_arch?).to be(false)
        end
      end

      context "and the current architecture does not match the name" do
        let(:architecture) { :s390 }

        it "returns false" do
          expect(subject.current_arch?).to be(false)
        end
      end
    end

    context "when 'archs' contains a list of names" do
      let(:archs) { ["ppc", "x86_64"] }

      context "and the current architecture matches any name" do
        let(:architecture) { :x86_64 }

        it "returns true" do
          expect(subject.current_arch?).to be(true)
        end
      end

      context "and the current architecture does not match any name" do
        let(:architecture) { :s390 }

        it "returns false" do
          expect(subject.current_arch?).to be(false)
        end
      end
    end

    context "when 'archs' contains names with and without '!'" do
      let(:subvol_specifications) { [subvol_spec("var", archs: ["ppc", "!board_powernv"])] }

      let(:archs) { ["ppc", "!x86_64"] }

      context "and positive names match current architecture and the negated do not" do
        let(:architecture) { :ppc }

        it "returns true" do
          expect(subject.current_arch?).to be(true)
        end
      end

      context "and both positive and negated names match the current architecture" do
        let(:archs) { ["ppc", "!ppc"] }
        let(:architecture) { :ppc }

        it "returns false" do
          expect(subject.current_arch?).to be(false)
        end
      end

      context "and any positive names match the current architecture" do
        let(:architecture) { :s390 }

        it "returns false" do
          expect(subject.current_arch?).to be(false)
        end
      end
    end
  end

  describe "#shadowed?" do
    let(:fs_mount_point) { "/" }

    let(:other) { ["/home", "/boot", "/opt", "/var/log"] }

    it "detects shadowing a /home subvolume with /home" do
      subject.path = "home"
      expect(subject.shadowed?(fs_mount_point, other)).to eq true
    end

    it "detects shadowing the /boot/xy/myarch subvolume with /boot" do
      subject.path = "boot/xy/myarch"
      expect(subject.shadowed?(fs_mount_point, other)).to eq true
    end

    it "does not report a false positive for shadowing a /booting/xy subvolume with /boot" do
      subject.path = "booting/xy"
      expect(subject.shadowed?(fs_mount_point, other)).to eq false
    end

    it "does not report a false positive for shadowing a /var subvolume with /var/log" do
      subject.path = "var"
      expect(subject.shadowed?(fs_mount_point, other)).to eq false
    end

    it "handles a nonexistent mount point well" do
      subject.path = "foo"
      expect(subject.shadowed?(fs_mount_point, other)).to eq false
    end

    it "handles an empty mount point well" do
      subject.path = ""
      expect(subject.shadowed?(fs_mount_point, other)).to eq false
    end

    it "handles a nil mount point well" do
      subject.path = nil
      expect(subject.shadowed?(fs_mount_point, other)).to eq false
    end

    it "returns false when the list of other mountpoints is empty" do
      subject.path = "/xy"
      expect(subject.shadowed?(fs_mount_point, [])).to eq false
    end

    it "returns false when the list of other mountpoints is nil" do
      subject.path = "/xy"
      expect(subject.shadowed?(fs_mount_point, nil)).to eq false
    end
  end

  describe "#create_btrfs_subvolume" do
    before do
      fake_scenario("mixed_disks_btrfs")
      subject.path = "foo"
      subject.copy_on_write = false
    end

    let(:blk_device) { Y2Storage::BlkDevice.find_by_name(devicegraph, dev_name) }
    let(:devicegraph) { Y2Storage::StorageManager.instance.staging }
    let(:dev_name) { "/dev/sdb2" }

    let(:filesystem) { blk_device.blk_filesystem }

    it "returns a BtrfsSubvolume" do
      expect(subject.create_btrfs_subvolume(filesystem)).to be_a(Y2Storage::BtrfsSubvolume)
    end

    it "adds the subvolume to the filesystem" do
      expect(filesystem.find_btrfs_subvolume_by_path("@/foo")).to be_nil
      subject.create_btrfs_subvolume(filesystem)
      expect(filesystem.find_btrfs_subvolume_by_path("@/foo")).to_not be_nil
    end

    it "creates the subvolume with correct nocow attribute" do
      subvolume = subject.create_btrfs_subvolume(filesystem)
      expect(subvolume.nocow?).to be(true)
    end

    it "creates the subvolume as 'can be auto deleted'" do
      subvolume = subject.create_btrfs_subvolume(filesystem)
      expect(subvolume.can_be_auto_deleted?).to be(true)
    end
  end
end
