#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require "y2storage/device_description"

RSpec.shared_examples "Encrypted device" do
  context "when the device is encrypted and the encryption status is required" do
    it "displays the encryption status" do
      # ignore case
      expect(description_with_encryption.downcase).to include("encrypted")
    end
  end
end

describe Y2Storage::DeviceDescription do
  include_context "yast2-storage-ng test setup"

  subject { described_class.new(device) }
  let(:subject_with_encryption) do
    dev = fake_devicegraph.find_by_name(device_name)
    # enable encryption
    dev.encrypt
    described_class.new(dev, include_encryption: true)
  end

  describe "#to_s" do
    let(:scenario) { "lvm-types1.xml" }
    let(:devicegraph) { fake_devicegraph }
    let(:blk_device) { fake_devicegraph.find_by_name(device_name) }
    let(:device_name) { "/dev/sda1" }
    let(:device) { blk_device }
    let(:blk_filesystem) { blk_device.blk_filesystem }
    let(:description) { subject.to_s }
    let(:description_with_encryption) { subject_with_encryption.to_s }

    before do
      fake_scenario(scenario)
    end

    context "when the device is a filesystem" do
      let(:scenario) { "mixed_disks_btrfs" }
      let(:device_name) { "/dev/sdd1" }
      let(:device) { blk_filesystem }

      include_examples "Encrypted device"

      it "returns its human readable type" do
        expect(description).to include("Btrfs")
      end
    end

    context "when the device is a Btrfs subvolume" do
      let(:scenario) { "mixed_disks_btrfs" }
      let(:filesystem) { devicegraph.find_by_name("/dev/sda2").filesystem }
      let(:device) { filesystem.btrfs_subvolumes.first }

      include_examples "Encrypted device"

      it "returns 'Btrfs Subvolume'" do
        expect(description).to eq("Btrfs Subvolume")
      end
    end

    context "when the device is an LVM volume group" do
      let(:device_name) { "/dev/vg0" }

      it "returns 'LVM'" do
        expect(description).to eq("LVM")
      end
    end

    context "when the device is an LVM non-thin snapshot" do
      let(:device_name) { "/dev/vg0/snap_normal1" }

      include_examples "Encrypted device"

      it "includes the 'Snapshot of'" do
        expect(description).to include("Snapshot of")
      end

      it "includes the origin volume basename" do
        expect(description).to include("normal1")
      end
    end

    context "when the device is an LVM thin snapshot" do
      let(:device_name) { "/dev/vg0/snap_thinvol1" }

      include_examples "Encrypted device"

      it "includes the 'Thin Snapshot of'" do
        expect(description).to include("Thin Snapshot of")
      end

      it "includes the origin volume basename" do
        expect(description).to include("thinvol1")
      end
    end

    context "when the device is formatted" do
      let(:device_name) { "/dev/vg0/cached1" }

      include_examples "Encrypted device"

      it "includes the human readable filesystem type" do
        expect(description).to include("XFS")
      end

      it "includes default device description" do
        expect(description).to include("Cache LV")
      end

      context "but it is the external journal of an Ext3/4 filesystem" do
        let(:scenario) { "bug_1145841.xml" }
        let(:device_name) { "/dev/sdd1" }

        include_examples "Encrypted device"

        it "includes the human readable filesystem type" do
          expect(description).to include("Ext4")
        end

        it "includes 'Journal'" do
          expect(description).to include("Journal")
        end

        it "includes the data device base name" do
          expect(description).to include("BACKUP_R6")
        end
      end

      context "but it is part of a multi-device filesystem" do
        let(:scenario) { "btrfs2-devicegraph.xml" }
        let(:device_name) { "/dev/sdb1" }

        include_examples "Encrypted device"

        it "includes 'Part of'" do
          expect(description).to include("Part of")
        end

        it "includes the filesystem name" do
          expect(description).to include("btrfs")
        end

        it "includes the block device basename" do
          expect(description).to include("sdb1")
        end
      end
    end

    context "when the device is not formatted" do
      context "and it is an used LVM physical volume" do
        let(:device_name) { "/dev/sdb1" }
        let(:vg) { device.lvm_pv.lvm_vg }

        context "in a volume group with name" do
          it "includes 'PV of'" do
            expect(description).to include("PV of")
          end

          it "includes the volume group name" do
            expect(description).to include("vg0")
          end
        end

        context "in a volume group with an empty name" do
          before do
            vg.vg_name = ""
          end

          it "returns 'PV of LVM'" do
            expect(description).to eq("PV of LVM")
          end
        end

        include_examples "Encrypted device"
      end

      context "and it is an unused LVM physical volume" do
        let(:scenario) { "unused_lvm_pvs.xml" }
        let(:device_name) { "/dev/sda2" }

        include_examples "Encrypted device"

        it "returns 'Unused LVM PV'" do
          expect(description).to eq("Unused LVM PV")
        end
      end

      context "and it is part of an MD RAID" do
        let(:scenario) { "md_raid" }
        let(:device_name) { "/dev/sda2" }

        include_examples "Encrypted device"

        it "includes 'Part of'" do
          expect(description).to include("Part of")
        end

        it "includes the MD RAID name" do
          expect(description).to include("md0")
        end
      end

      context "and it is part of a bcache" do
        let(:scenario) { "bcache1.xml" }
        let(:device_name) { "/dev/vdc" }

        include_examples "Encrypted device"

        it "includes 'Backing of'" do
          expect(description).to include("Backing of")
        end

        it "includes the bcache name" do
          expect(description).to include("bcache0")
        end
      end

      context "and it is used as caching device in a bcache" do
        let(:scenario) { "bcache1.xml" }
        let(:device_name) { "/dev/vdb" }

        it "returns 'Bcache caching'" do
          expect(description).to include("Bcache caching")
        end
      end
    end
  end
end
