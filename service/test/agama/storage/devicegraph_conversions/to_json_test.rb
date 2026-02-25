# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require_relative "../storage_helpers"
require "agama/storage/devicegraph_conversions"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

describe Agama::Storage::DevicegraphConversions::ToJSON do
  include Agama::RSpec::StorageHelpers

  before do
    mock_storage(devicegraph: scenario)
    allow_any_instance_of(Y2Storage::Partition).to receive(:resize_info).and_return(resize_info)
  end

  subject { described_class.new(devicegraph) }

  let(:devicegraph) { Y2Storage::StorageManager.instance.probed }

  let(:resize_info) do
    instance_double(
      Y2Storage::ResizeInfo, resize_ok?: true, reasons: [],
      min_size: Y2Storage::DiskSize.GiB(20), max_size: Y2Storage::DiskSize.GiB(40)
    )
  end

  describe "#convert" do
    describe "for a devicegraph with several disks" do
      let(:scenario) { "disks.yaml" }

      it "generates an entry for each disk" do
        json = subject.convert
        expect(json.map { |e| e[:name] }).to contain_exactly("/dev/vda", "/dev/vdb", "/dev/vdc")
        expect(json.map { |e| e[:class] }).to all(eq "drive")
      end

      it "exports the block device sizes in bytes" do
        json = subject.convert
        expect(json.map { |e| e[:block][:size] }).to all eq(50 * (1024**3))
      end

      it "generates the :partitions and :partitionTable entries only for partitioned disks" do
        json = subject.convert

        vda = json.find { |d| d[:name] == "/dev/vda" }
        expect(vda[:partitions].size).to eq 3
        expect(vda[:partitions].map { |p| p[:class] }).to all(eq "partition")
        expect(vda[:partitionTable][:type]).to eq "gpt"
        expect(vda[:partitionTable][:unusedSlots]).to contain_exactly(
          a_hash_including(start: Integer, size: Integer)
        )

        vdb = json.find { |d| d[:name] == "/dev/vdb" }
        expect(vdb.keys).to_not include :partitions
        expect(vdb.keys).to_not include :partitionTable

        vdc = json.find { |d| d[:name] == "/dev/vdc" }
        expect(vdc.keys).to_not include :partitions
        expect(vdc.keys).to_not include :partitionTable
      end

      it "generates the :filesystem entry only for formatted disks" do
        json = subject.convert

        vda = json.find { |d| d[:name] == "/dev/vda" }
        expect(vda.keys).to_not include :filesystem

        vdb = json.find { |d| d[:name] == "/dev/vdb" }
        expect(vdb.keys).to_not include :filesystem

        vdc = json.find { |d| d[:name] == "/dev/vdc" }
        expect(vdc.keys).to include :filesystem
        expect(vdc[:filesystem][:type]).to eq "ext4"
      end
    end

    describe "for a devicegraph with LVM" do
      let(:scenario) { "trivial_lvm.yml" }

      it "generates an entry for each disk and volume group" do
        json = subject.convert
        expect(json).to contain_exactly(
          a_hash_including(name: "/dev/sda", class: "drive"),
          a_hash_including(name: "/dev/vg0", class: "volumeGroup")
        )
      end

      it "exports the size and physical volumes of the LVM volume group" do
        json = subject.convert
        vg0 = json.find { |d| d[:name] == "/dev/vg0" }
        expect(vg0[:volumeGroup][:size]).to eq (100 * (1024**3)) - (4 * (1024**2))
        pvs = vg0[:volumeGroup][:physicalVolumes]
        expect(pvs).to be_a Array
        expect(pvs.size).to eq 1
      end

      it "generates the :logicalVolumes entries only for LVM volume groups" do
        json = subject.convert

        sda = json.find { |d| d[:name] == "/dev/sda" }
        expect(sda.keys).to_not include :logicalVolumes

        vg0 = json.find { |d| d[:name] == "/dev/vg0" }
        lvs = vg0[:logicalVolumes]
        expect(lvs.map { |lv| lv[:name] }).to eq ["/dev/vg0/lv1"]
        expect(lvs.first[:block].keys).to include :size
        expect(lvs.first[:class]).to eq "logicalVolume"
      end

      it "generates the :filesystem entry for formatted logical volumes" do
        json = subject.convert
        vg0 = json.find { |d| d[:name] == "/dev/vg0" }
        lv = vg0[:logicalVolumes].first

        expect(lv.keys).to include :filesystem
        expect(lv[:filesystem][:type]).to eq "btrfs"
      end
    end

    describe "for a devicegraph with MD RAIDs" do
      let(:scenario) { "md_disks.yaml" }

      it "generates an entry for each disk and MD RAID" do
        json = subject.convert
        expect(json).to contain_exactly(
          a_hash_including(name: "/dev/vda", class: "drive"),
          a_hash_including(name: "/dev/vdb", class: "drive"),
          a_hash_including(name: "/dev/md0", class: "mdRaid")
        )
      end

      it "exports the level and members of the MD RAIDs" do
        json = subject.convert
        md0 = json.find { |d| d[:name] == "/dev/md0" }
        expect(md0[:md][:level]).to eq "raid0"
        members = md0[:md][:devices]
        expect(members).to be_a Array
        expect(members.size).to eq 2
      end
    end

    describe "for a devicegraph with multipath devices" do
      let(:scenario) { "multipath-formatted.xml" }

      it "generates an entry for each multipath device" do
        json = subject.convert
        expect(json.map { |e| e[:name] }).to eq ["/dev/mapper/0QEMU_QEMU_HARDDISK_mpath1"]
      end

      it "exports the name of the multipath wires" do
        json = subject.convert
        wires = json.first[:multipath][:wireNames]
        expect(wires).to contain_exactly("/dev/sda", "/dev/sdb")
      end
    end
  end
end
