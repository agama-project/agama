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
require "y2storage/filesystems/nfs_options"

describe Y2Storage::Filesystems::NfsOptions do
  include_context "yast2-storage-ng test setup"

  subject { described_class.new(options) }

  let(:options) { [] }

  describe ".create_from_fstab" do
    context "when the fstab options only contains 'defaults'" do
      let(:fstab_options) { "defaults" }

      it "returns a NfsOptions object without options" do
        nfs_options = described_class.create_from_fstab(fstab_options)

        expect(nfs_options).to be_a(described_class)

        expect(nfs_options.options).to be_empty
      end
    end

    context "when the fstab options contains comma separated options" do
      let(:fstab_options) { "defaults,rw,fsck" }

      it "returns a NfsOptions object with the list of options" do
        nfs_options = described_class.create_from_fstab(fstab_options)

        expect(nfs_options).to be_a(described_class)

        expect(nfs_options.options).to contain_exactly("defaults", "rw", "fsck")
      end
    end
  end

  describe "#to_fstab" do
    let(:options) { [] }

    context "when it has no options" do
      it "returns 'defaults'" do
        expect(subject.to_fstab).to eq("defaults")
      end
    end

    context "when it has options" do
      let(:options) { ["rw", "fsck"] }

      it "returns the options separated by comma" do
        expect(subject.to_fstab).to eq("rw,fsck")
      end
    end
  end

  describe "#version" do
    it "returns a NfsVersion object" do
      expect(subject.version).to be_a(Y2Storage::Filesystems::NfsVersion)
    end

    it "returns the any version if none of vers or nfsvers is used" do
      [
        "defaults",
        "nolock,bg",
        "nolock,minorversion=1",
        "nolock,rsize=8192",
        "defaults,ro,noatime,minorversion=1,users,exec"
      ].each do |options|
        nfs_options = described_class.create_from_fstab(options)

        expect(nfs_options.version.value).to eq("any")
      end
    end

    it "returns the version specified by nfsvers if it's present" do
      {
        "nfsvers=4"                => "4",
        "nfsvers=4,minorversion=1" => "4",
        "nfsvers=4.0"              => "4",
        "nfsvers=4.2"              => "4.2",
        "defaults,nfsvers=3"       => "3",
        "nfsvers=4.1,nolock"       => "4.1"
      }.each_pair do |options, version|
        nfs_options = described_class.create_from_fstab(options)

        expect(nfs_options.version.value).to eq(version)
      end
    end

    it "returns the version specified by vers if it's present" do
      {
        "minorversion=1,vers=4" => "4",
        "vers=3,ro"             => "3",
        "vers=4.1"              => "4.1",
        "vers=4.2"              => "4.2"
      }.each_pair do |options, version|
        nfs_options = described_class.create_from_fstab(options)

        expect(nfs_options.version.value).to eq(version)
      end
    end

    it "returns the correct version if nfsvers and vers appear several time" do
      {
        "nfsvers=4,minorversion=1,vers=3"        => "3",
        "vers=3,ro,vers=4"                       => "4",
        "vers=4.1,rw,nfsvers=3,nfsvers=4,nolock" => "4"
      }.each_pair do |options, version|
        nfs_options = described_class.create_from_fstab(options)

        expect(nfs_options.version.value).to eq(version)
      end
    end

    it "returns nil if an unknown version appears" do
      [
        "nfsvers=4.5",
        "vers=5,rw"
      ].each do |options|
        nfs_options = described_class.create_from_fstab(options)

        expect(nfs_options.version).to be_nil
      end
    end
  end

  describe "#version=" do
    def set_version(options, value)
      nfs_options = described_class.create_from_fstab(options)

      version = Y2Storage::Filesystems::NfsVersion.find_by_value(value)

      nfs_options.version = version

      nfs_options.to_fstab
    end

    it "removes existing minorversion options" do
      expect(set_version("minorversion=1", "any")).to eq("defaults")
      expect(set_version("minorversion=1,ro,minorversion=1", "4")).to eq("ro,nfsvers=4")
    end

    it "removes nfsvers and vers when enforcing no particular version" do
      expect(set_version("nfsvers=4", "any")).to eq("defaults")
      expect(set_version("vers=3,ro", "any")).to eq("ro")
      expect(set_version("nolock,vers=4.1,rw,nfsvers=4", "any")).to eq("nolock,rw")
      expect(set_version("nolock,vers=4.2,rw,nfsvers=4", "any")).to eq("nolock,rw")
    end

    it "modifies the existing nfsvers or vers option if needed" do
      expect(set_version("nfsvers=4", "3")).to eq("nfsvers=3")
      expect(set_version("vers=3,ro", "4")).to eq("vers=4,ro")
      expect(set_version("nolock,nfsvers=4.1,rw,vers=4", "4.1")).to eq("nolock,rw,vers=4.1")
      expect(set_version("nolock,nfsvers=4.2,rw,vers=4", "4.2")).to eq("nolock,rw,vers=4.2")
    end

    it "deletes surplus useless nfsvers and vers options" do
      expect(set_version("vers=4,nolock,nfsvers=4.1,rw,vers=4", "4.1")).to eq("nolock,rw,vers=4.1")
      expect(set_version("nfsvers=4,vers=4.1,rw,nfsvers=4", "3")).to eq("rw,nfsvers=3")
    end

    it "adds a nfsvers if a new option is needed" do
      expect(set_version("defaults", "4.1")).to eq("nfsvers=4.1")
      expect(set_version("defaults", "4.2")).to eq("nfsvers=4.2")
      expect(set_version("rw,nolock", "3")).to eq("rw,nolock,nfsvers=3")
    end
  end

  describe "#legacy?" do
    context "when options contain 'minorversion'" do
      let(:options) { ["minorversion=1"] }

      it "returns true" do
        expect(subject.legacy?).to eq(true)
      end
    end

    context "when options do not contain 'minorversion'" do
      let(:options) { ["rw", "vers=4"] }

      it "returns false" do
        expect(subject.legacy?).to eq(false)
      end
    end
  end
end
