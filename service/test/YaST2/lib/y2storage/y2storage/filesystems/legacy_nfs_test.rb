#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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
require "y2storage/filesystems/legacy_nfs"

describe Y2Storage::Filesystems::LegacyNfs do
  include_context "yast2-storage-ng test setup"

  subject(:filesystem) { described_class.new }

  describe "#nfs_options" do
    before do
      subject.fstopt = fstopt
    end

    let(:fstopt) { nil }

    it "returns a NfsOptions object" do
      expect(subject.nfs_options).to be_a(Y2Storage::Filesystems::NfsOptions)
    end

    context "if there is no fstab options" do
      let(:fstopt) { nil }

      it "returns a NfsOptions with defaults options" do
        expect(subject.nfs_options.to_fstab).to eq("defaults")
      end
    end

    context "if there are fstab options" do
      let(:fstopt) { "rw,fsck" }

      it "returns a NfsOptions with the options" do
        expect(subject.nfs_options.options).to contain_exactly("rw", "fsck")
      end
    end
  end

  describe "#legacy_version?" do
    context "when the filesystem type is NFS4" do
      before do
        allow(subject).to receive(:fs_type).and_return(Y2Storage::Filesystems::Type::NFS4)
      end

      it "returns true" do
        expect(subject.legacy_version?).to eq(true)
      end
    end

    context "when the filesystem type is NFS" do
      before do
        allow(subject).to receive(:fs_type).and_return(Y2Storage::Filesystems::Type::NFS)
      end

      context "and it has legacy options" do
        before do
          subject.fstopt = "minorversion=1"
        end

        it "returns true" do
          expect(subject.legacy_version?).to eq(true)
        end
      end

      context "and it has no legacy options" do
        before do
          subject.fstopt = "rw"
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

    it "returns the version according to the fstab options" do
      subject.fstopt = "vers=4.1"

      expect(subject.version.value).to eq("4.1")
    end
  end

  describe "#reachable?" do
    let(:error) { Cheetah::ExecutionFailed.new([], "", nil, nil) }

    context "when it is possible to mount the NFS share in the local system" do
      before do
        allow(Yast::Execute).to receive(:locally!)
      end

      it "returns true" do
        expect(subject.reachable?).to eq true
      end
    end

    context "when there is any error mounting the NFS share in the local system" do
      before do
        allow(Yast::Execute).to receive(:locally!)
        allow(Yast::Execute).to receive(:locally!).with("/usr/bin/mount", any_args).and_raise(error)
      end

      it "returns false" do
        expect(subject.reachable?).to eq false
      end
    end
  end

  describe ".new_from_hash" do
    context "if all possible values are given" do
      let(:hash) do
        {
          "device"       => "server.example.org:/remote/path",
          "mount"        => "/local/path",
          "fstopt"       => "rw,exec",
          "vfstype"      => "nfs4",
          "active"       => false,
          "in_etc_fstab" => false
        }
      end

      it "returns a LegacyNfs object with all fields correctly set" do
        result = described_class.new_from_hash(hash)
        expect(result).to be_a(Y2Storage::Filesystems::LegacyNfs)
        expect(result.server).to eq "server.example.org"
        expect(result.path).to eq "/remote/path"
        expect(result.mountpoint).to eq "/local/path"
        expect(result.fstopt).to eq "rw,exec"
        expect(result.fs_type).to eq Y2Storage::Filesystems::Type::NFS4
        expect(result.active?).to eq false
        expect(result.in_etc_fstab?).to eq false
      end
    end

    context "if a minimal hash is given" do
      let(:hash) { { "device" => "server.example.org:/remote/path" } }

      it "returns a LegacyNfs object with default attributes" do
        result = described_class.new_from_hash(hash)
        expect(result).to be_a(Y2Storage::Filesystems::LegacyNfs)
        expect(result.server).to eq "server.example.org"
        expect(result.path).to eq "/remote/path"
        expect(result.mountpoint).to be_nil
        expect(result.fstopt).to be_nil
        expect(result.fs_type).to eq Y2Storage::Filesystems::Type::NFS
        expect(result.active?).to eq true
        expect(result.in_etc_fstab?).to eq true
      end
    end
  end
end
