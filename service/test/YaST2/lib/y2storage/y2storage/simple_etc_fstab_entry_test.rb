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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"

require "y2storage/simple_etc_fstab_entry"

describe Y2Storage::SimpleEtcFstabEntry do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)
  end

  subject { fstab_entry(device, "/", btrfs, mount_options, 0, 0) }

  let(:device) { "/dev/sda2" }

  let(:btrfs) { Y2Storage::Filesystems::Type::BTRFS }

  let(:mount_options) { [] }

  let(:devicegraph) { Y2Storage::StorageManager.instance.staging }

  let(:scenario) { "mixed_disks" }

  describe "#subvolume?" do
    context "when the entry is for a BTRFS subvolume" do
      let(:mount_options) { ["subvol=@/home"] }

      it "returns true" do
        expect(subject.subvolume?).to eq(true)
      end
    end

    context "when the entry is not for a BTRFS subvolume" do
      let(:mount_options) { ["rw"] }

      it "returns false" do
        expect(subject.subvolume?).to eq(false)
      end
    end
  end

  describe "#filesystem" do
    context "when the filesystem for the entry is found in system" do
      let(:device) { "/dev/sda2" }

      it "returns the filesystem" do
        filesystem = subject.filesystem(devicegraph)

        expect(filesystem).to_not be_nil
        expect(filesystem.blk_devices.first.name).to eq(device)
      end
    end

    context "when the filesystem for the entry is not found in system" do
      let(:device) { "UUID=unknown" }

      it "returns nil" do
        expect(subject.filesystem(devicegraph)).to be_nil
      end
    end
  end

  describe "#device" do
    context "when the fstab entry contains a block device spec" do
      let(:scenario) { "encrypted_partition.xml" }

      context "and the block device is found in the system" do
        let(:device) { "/dev/disk/by-id/ata-VBOX_HARDDISK_VB777f5d67-56603f01-part1" }

        it "returns the block device" do
          device = subject.device(devicegraph)

          expect(device.is?(:blk_device)).to eq(true)
          expect(device.name).to eq("/dev/sda1")
        end
      end

      context "and the block device is not found in the system" do
        let(:device) { "/dev/disk/by-id/does-not-exist" }

        # Mock the system lookup performed as last resort to find a device
        before { allow(Y2Storage::BlkDevice).to receive(:find_by_any_name) }

        it "returns nil" do
          expect(subject.device(devicegraph)).to be_nil
        end
      end
    end

    context "when the fstab entry contains a filesystem spec" do
      context "and the filesystem is found in the system" do
        context "and the filesystem is a NFS" do
          let(:scenario) { "nfs1.xml" }
          let(:device) { "srv:/home/a" }

          it "returns the NFS" do
            device = subject.device(devicegraph)

            expect(device.is?(:nfs)).to eq(true)
            expect(device.name).to eq("srv:/home/a")
          end
        end

        context "and the filesystem is a block filesystem" do
          let(:scenario) { "swaps" }
          let(:device) { "UUID=11111111-1111-1111-1111-11111111" }

          it "returns the underlying block device" do
            device = subject.device(devicegraph)

            expect(device.is?(:blk_device)).to eq(true)
            expect(device.name).to eq("/dev/sda1")
          end
        end
      end

      context "and the filesystem is not found in the system" do
        let(:scenario) { "swaps" }
        let(:device) { "UUID=does-not-exist" }

        it "returns nil" do
          expect(subject.device(devicegraph)).to be_nil
        end
      end
    end
  end

  describe "#mount_by" do
    context "when the fstab entry indicates the device by its kernel name" do
      let(:device) { "/dev/sda2" }

      it "returns mount by device" do
        expect(subject.mount_by.is?(:device)).to eq(true)
      end
    end

    context "when the fstab entry indicates the device by id" do
      let(:device) { "/dev/disk/by-id/ata-VBOX_HARDDISK_VB777f5d67-56603f01-part1" }

      it "returns mount by id" do
        expect(subject.mount_by.is?(:id)).to eq(true)
      end
    end

    context "when the fstab entry indicates the device by path" do
      let(:device) { "/dev/disk/by-path/pci-0000:00:1f.2-ata-1-part1" }

      it "returns mount by path" do
        expect(subject.mount_by.is?(:path)).to eq(true)
      end
    end

    context "when the fstab entry indicates the device by label" do
      let(:device) { "LABEL=root" }

      it "returns mount by label" do
        expect(subject.mount_by.is?(:label)).to eq(true)
      end
    end

    context "when the fstab entry indicates the device by uuid" do
      let(:device) { "UUID=1111-2222-3333" }

      it "returns mount by uuid" do
        expect(subject.mount_by.is?(:uuid)).to eq(true)
      end
    end

    context "when the device format is not recognized" do
      let(:device) { "foo-bar" }

      it "returns nil" do
        expect(subject.mount_by).to be_nil
      end
    end
  end
end
