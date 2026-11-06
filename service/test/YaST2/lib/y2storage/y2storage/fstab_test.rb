#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2018] SUSE LLC
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

require "y2storage/fstab"

describe Y2Storage::Fstab do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)

    allow(Storage).to receive(:read_simple_etc_fstab).and_return(storage_entries)
  end

  let(:swap) { Y2Storage::Filesystems::Type::SWAP }

  let(:btrfs) { Y2Storage::Filesystems::Type::BTRFS }

  let(:fstab_entries) do
    [
      fstab_entry("/dev/sda1", "swap", swap, [], 0, 0),
      fstab_entry("/dev/sda2", "/", btrfs, [], 0, 0),
      fstab_entry("/dev/sda2", "/home", btrfs, ["subvol=@/home"], 0, 0)
    ]
  end

  let(:storage_entries) { fstab_entries.map(&:to_storage_value) }

  let(:path) { "" }

  let(:filesystem) { nil }

  let(:scenario) { "mixed_disks" }

  subject { described_class.new(path, filesystem) }

  describe "#initialize" do
    it "reads and sets the fstab entries" do
      expect(subject.entries.map(&:to_storage_value)).to eq(storage_entries)
    end

    context "when there is some problem reading the entries" do
      before do
        allow(Storage).to receive(:read_simple_etc_fstab).and_raise(Storage::Exception)
      end

      it "sets an empty list of entries" do
        expect(subject.entries).to be_empty
      end
    end
  end

  describe "#filesystem_entries" do
    it "returns a list of fstab entries" do
      expect(subject.filesystem_entries).to all(be_a(Y2Storage::SimpleEtcFstabEntry))
    end

    it "includes all entries that correspond to a filesystem" do
      entries = subject.filesystem_entries

      expect(entries).to include(
        an_object_having_attributes(mount_point: "swap"),
        an_object_having_attributes(mount_point: "/")
      )
    end

    it "excludes entries that correspond to a BTRFS subvolume" do
      entries = subject.filesystem_entries

      expect(entries).to_not include(
        an_object_having_attributes(mount_point: "/home")
      )
    end
  end

  describe "#device" do
    let(:devicegraph) { Y2Storage::StorageManager.instance.staging }

    context "when the fstab file belongs to a block filesystem" do
      let(:device) { devicegraph.find_by_name("/dev/sda2") }

      let(:filesystem) { device.filesystem }

      it "returns the device of the filesystem" do
        expect(subject.device).to eq(device)
      end
    end

    context "when the fstab file belongs to a NFS" do
      let(:scenario) { "nfs1.xml" }

      let(:filesystem) { devicegraph.filesystems.find { |f| f.name == "srv:/home/a" } }

      it "returns nil" do
        expect(subject.device).to be_nil
      end
    end
  end
end
