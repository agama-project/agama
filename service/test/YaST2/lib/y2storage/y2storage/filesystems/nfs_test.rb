#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2018-2022] SUSE LLC
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

describe Y2Storage::Filesystems::Nfs do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario("nfs1.xml")
  end

  subject(:filesystem) { fake_devicegraph.find_device(42) }

  describe "#match_fstab_spec?" do
    it "returns true for the correct NFS spec" do
      expect(filesystem.match_fstab_spec?("srv:/home/a")).to eq true
    end

    it "returns true if the spec contains a trailing slash" do
      expect(filesystem.match_fstab_spec?("srv:/home/a/")).to eq true
    end

    it "returns false for any other NFS spec" do
      expect(filesystem.match_fstab_spec?("srv2:/home/b")).to eq false
    end

    it "returns false for any spec starting with LABEL=" do
      expect(filesystem.match_fstab_spec?("LABEL=label")).to eq false
    end

    it "returns false for any spec starting with UUID=" do
      expect(filesystem.match_fstab_spec?("UUID=0000-00-00")).to eq false
    end

    it "returns false for any device name" do
      expect(filesystem.match_fstab_spec?("/dev/sda1")).to eq false
      expect(filesystem.match_fstab_spec?("/dev/disk/by-label/whatever")).to eq false
    end
  end

  describe "#legacy_version?" do
    context "when the filesystem type is NFS4" do
      before do
        subject.mount_point.mount_type = Y2Storage::Filesystems::Type::NFS4
      end

      it "returns true" do
        expect(subject.legacy_version?).to eq(true)
      end
    end

    context "when the filesystem type is NFS" do
      before do
        subject.mount_point.mount_type = Y2Storage::Filesystems::Type::NFS
      end

      context "and it has legacy options" do
        before do
          subject.mount_point.mount_options = ["minorversion=1"]
        end

        it "returns true" do
          expect(subject.legacy_version?).to eq(true)
        end
      end

      context "and it has no legacy options" do
        before do
          subject.mount_point.mount_options = ["rw"]
        end

        it "returns false" do
          expect(subject.legacy_version?).to eq(false)
        end
      end
    end
  end

  describe "#version" do
    it "returns a NfsVersion object" do
      expect(subject.version).to be_a(Y2Storage::Filesystems::NfsVersion)
    end

    it "returns the version according to the mount options" do
      subject.mount_point.mount_options = ["vers=4.1"]

      expect(subject.version.value).to eq("4.1")
    end
  end

  describe "#reachable?" do
    context "when libstorage-ng is able to provide space information" do
      before { allow(subject).to receive(:detect_space_info).and_return space_info }
      let(:space_info) { double(Y2Storage::SpaceInfo) }

      it "returns true" do
        expect(subject.reachable?).to eq true
      end
    end

    context "when libstorage-ng fails to provide space information" do
      before { allow(subject).to receive(:detect_space_info).and_raise(::Storage::Exception) }

      it "returns false" do
        expect(subject.reachable?).to eq false
      end
    end
  end

  describe "#to_legacy_hash" do
    it "returns a hash with the correct entries" do
      expected = {
        "device"       => subject.name,
        "mount"        => subject.mount_path,
        "used_fs"      => :nfs,
        "fstopt"       => "defaults",
        "active"       => subject.mount_point.active?,
        "in_etc_fstab" => subject.mount_point.in_etc_fstab?
      }
      expect(subject.to_legacy_hash).to eq expected
    end
  end
end
