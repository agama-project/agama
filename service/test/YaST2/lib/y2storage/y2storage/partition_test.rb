#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2019] SUSE LLC
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

describe Y2Storage::Partition do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  before do
    fake_scenario(scenario)
  end
  let(:scenario) { "autoyast_drive_examples" }

  describe ".all" do
    it "returns a list of Y2Storage::Partition objects" do
      partitions = Y2Storage::Partition.all(fake_devicegraph)
      expect(partitions).to be_an Array
      expect(partitions).to all(be_a(Y2Storage::Partition))
    end

    it "includes all primary, extended and logical partitions in the devicegraph" do
      partitions = Y2Storage::Partition.all(fake_devicegraph)
      expect(partitions.map(&:basename)).to contain_exactly(
        "sdb1", "sdb2", "dasdb1", "dasdb2", "dasdb3", "sdc1", "sdc2", "sdc3", "sdd1",
        "sdd2", "sdd3", "sdd4", "sdd5", "sdd6", "sdaa1", "sdaa2", "sdaa3", "sdf1", "sdf2",
        "sdf5", "sdf6", "sdf7", "sdf8", "sdf9", "sdf10", "sdf11", "sdh1", "sdh2", "sdh3",
        "sdi1", "sdj1", "sdj2", "sdj3", "nvme0n1p1", "nvme0n1p2", "nvme0n1p3", "nvme0n1p4"
      )
    end
  end

  describe ".sorted_by_name" do
    it "returns a list of Y2Storage::Partition objects" do
      partitions = Y2Storage::Partition.sorted_by_name(fake_devicegraph)
      expect(partitions).to be_an Array
      expect(partitions).to all(be_a(Y2Storage::Partition))
    end

    it "includes all primary, extended and logical partitions, sorted by name" do
      partitions = Y2Storage::Partition.sorted_by_name(fake_devicegraph)
      expect(partitions.map(&:basename)).to eq [
        "dasdb1", "dasdb2", "dasdb3", "nvme0n1p1", "nvme0n1p2", "nvme0n1p3", "nvme0n1p4",
        "sdb1", "sdb2", "sdc1", "sdc2", "sdc3", "sdd1", "sdd2", "sdd3", "sdd4", "sdd5",
        "sdd6", "sdf1", "sdf2", "sdf5", "sdf6", "sdf7", "sdf8", "sdf9", "sdf10", "sdf11",
        "sdh1", "sdh2", "sdh3", "sdi1", "sdj1", "sdj2", "sdj3", "sdaa1", "sdaa2", "sdaa3"
      ]
    end

    context "even if Partitionable.all returns an unsorted array" do
      before do
        allow(Y2Storage::Partitionable).to receive(:all) do |devicegraph|
          # Let's shuffle things a bit
          shuffle(Y2Storage::BlkDevice.all(devicegraph).select { |i| i.is?(:dasd, :disk) })
        end
      end

      it "returns an array sorted by name" do
        partitions = Y2Storage::Partition.sorted_by_name(fake_devicegraph)
        expect(partitions.map(&:basename)).to eq [
          "dasdb1", "dasdb2", "dasdb3", "nvme0n1p1", "nvme0n1p2", "nvme0n1p3", "nvme0n1p4",
          "sdb1", "sdb2", "sdc1", "sdc2", "sdc3", "sdd1", "sdd2", "sdd3", "sdd4", "sdd5",
          "sdd6", "sdf1", "sdf2", "sdf5", "sdf6", "sdf7", "sdf8", "sdf9", "sdf10", "sdf11",
          "sdh1", "sdh2", "sdh3", "sdi1", "sdj1", "sdj2", "sdj3", "sdaa1", "sdaa2", "sdaa3"
        ]
      end
    end
  end

  describe "#adapted_id=" do
    subject(:partition) { Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/sdb1") }

    let(:swap) { Y2Storage::PartitionId::SWAP }
    let(:linux) { Y2Storage::PartitionId::LINUX }
    let(:win_data) { Y2Storage::PartitionId::WINDOWS_BASIC_DATA }

    let(:partition_table) { double("PartitionTable") }
    before { allow(partition).to receive(:partition_table).and_return partition_table }

    it "relies on PartitionTable#partition_id_for to adapt the id" do
      expect(partition_table).to receive(:partition_id_for).with(swap).and_return linux
      partition.adapted_id = swap
    end

    context "if libstorage-ng accepts the adapted id" do
      before do
        allow(partition_table).to receive(:partition_id_for).and_return swap
      end

      it "sets the id to the adapted one" do
        partition.adapted_id = linux
        expect(partition.id).to eq swap
      end
    end

    context "if libstorage-ng rejects the adapted id with an exception" do
      before do
        allow(partition_table).to receive(:partition_id_for).and_return win_data
      end

      it "does not propagate the exception" do
        expect { partition.adapted_id = swap }.to_not raise_error
      end

      it "sets the id always to LINUX" do
        partition.adapted_id = swap
        expect(partition.id).to eq linux
      end
    end

    context "if a different exception is raised in the process" do
      before do
        allow(partition_table).to receive(:partition_id_for).and_raise ArgumentError
      end

      it "propagates the exception" do
        expect { partition.adapted_id = swap }.to raise_error ArgumentError
      end
    end
  end

  describe "#start_aligned?" do
    let(:scenario) { "dasd_50GiB" }

    subject(:partition) { Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/dasda1") }

    before do
      partition.region.start = start
    end

    context "when the first sector is aligned" do
      let(:start) { 48 }

      it "returns true" do
        expect(partition.start_aligned?).to eq(true)
      end
    end

    context "when the first sector is not aligned" do
      let(:start) { 100 }

      it "returns false" do
        expect(partition.start_aligned?).to eq(false)
      end
    end
  end

  describe "#end_aligned?" do
    let(:scenario) { "dasd_50GiB" }

    subject(:partition) { Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/dasda1") }

    before do
      partition.region.length = length
    end

    context "when the last sector is aligned" do
      let(:length) { 96 }

      it "returns true" do
        expect(partition.end_aligned?).to eq(true)
      end
    end

    context "when the last sector is not aligned" do
      let(:length) { 100 }

      it "returns false" do
        expect(partition.end_aligned?).to eq(false)
      end
    end
  end

  describe "#resize" do
    let(:scenario) { "dasd1.xml" }

    subject(:partition) { Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/dasda3") }

    before { allow(partition).to receive(:detect_resize_info).and_return resize_info }

    let(:resize_info) do
      double(Y2Storage::ResizeInfo, resize_ok?: ok,
        min_size: min, max_size: max,
        reasons: 0, reason_texts: [])
    end
    let(:ok) { true }
    let(:min) { 2.GiB }
    let(:max) { 5.GiB }

    context "if the partition cannot be resized" do
      let(:ok) { false }

      it "does not modify the partition" do
        initial_size = partition.size
        initial_end = partition.end
        initial_start = partition.start

        partition.resize(4.5.GiB)

        expect(partition.size).to eq initial_size
        expect(partition.end).to eq initial_end
        expect(partition.start).to eq initial_start
      end
    end

    RSpec.shared_examples "start not modified" do
      it "does not modify the partition start" do
        initial_start = partition.start
        partition.resize(new_size, align_type: align_type)
        expect(partition.start).to eq initial_start
      end
    end

    RSpec.shared_examples "requested size" do
      it "resizes the partition to the requested size" do
        partition.resize(new_size, align_type: align_type)
        expect(partition.size).to eq new_size
      end
    end

    RSpec.shared_examples "closest valid value" do
      it "resizes the partition to the closest valid size" do
        partition.resize(new_size, align_type: align_type)

        expect(partition.size).to_not eq new_size
        diff = (new_size.to_i - partition.size.to_i).abs
        expect(diff).to be < partition.partition_table.align_grain(align_type).to_i
      end
    end

    RSpec.shared_examples "keep original size" do
      it "does not modify the partition" do
        initial_size = partition.size
        initial_end = partition.end
        initial_start = partition.start

        partition.resize(new_size, align_type: align_type)

        expect(partition.size).to eq initial_size
        expect(partition.end).to eq initial_end
        expect(partition.start).to eq initial_start
      end
    end

    # A couple of shortcuts
    let(:optimal) { Y2Storage::AlignType::OPTIMAL }
    let(:required) { Y2Storage::AlignType::REQUIRED }

    context "if the requested size causes the end to be fully aligned" do
      let(:new_size) { 4.5.GiB - 3.MiB + 960.KiB }

      context "and align_type is set to nil" do
        let(:align_type) { nil }

        include_examples "requested size"
        include_examples "start not modified"
      end

      context "and align_type is set to OPTIMAL" do
        let(:align_type) { optimal }

        include_examples "requested size"
        include_examples "start not modified"
      end

      context "and align_type is set to REQUIRED" do
        let(:align_type) { required }

        include_examples "requested size"
        include_examples "start not modified"
      end
    end

    context "if the new size causes the end to be misaligned" do
      let(:new_size) { 4.5.GiB + 64.KiB }

      context "and align_type is set to nil" do
        let(:align_type) { nil }

        include_examples "requested size"
        include_examples "start not modified"

        it "does not align the end of the partition" do
          partition.resize(new_size, align_type: align_type)

          expect(partition.end_aligned?(required)).to eq false
          expect(partition.end_aligned?(optimal)).to eq false
        end
      end

      context "and align_type is set to OPTIMAL" do
        let(:align_type) { optimal }

        include_examples "closest valid value"

        it "ensures the end of the partition is optimally aligned" do
          partition.resize(new_size, align_type: align_type)
          expect(partition.end_aligned?).to eq true
        end

        include_examples "start not modified"
      end

      context "and align_type is set to REQUIRED" do
        let(:align_type) { required }

        include_examples "closest valid value"

        it "ensures the end of the partition is aligned to requirements" do
          partition.resize(new_size, align_type: align_type)
          expect(partition.end_aligned?(required)).to eq true
        end

        include_examples "start not modified"
      end
    end

    context "if the new size causes the end to be aligned only to hard requirements" do
      let(:new_size) { 4.5.GiB }

      context "and align_type is set to nil" do
        let(:align_type) { nil }

        include_examples "requested size"
        include_examples "start not modified"
      end

      context "and align_type is set to OPTIMAL" do
        let(:align_type) { optimal }

        include_examples "closest valid value"

        it "ensures the end of the partition is optimally aligned" do
          partition.resize(new_size, align_type: align_type)
          expect(partition.end_aligned?).to eq true
        end

        include_examples "start not modified"
      end

      context "and align_type is set to REQUIRED" do
        let(:align_type) { required }

        include_examples "requested size"
        include_examples "start not modified"
      end
    end

    context "if the new size is bigger than the max resizing size" do
      let(:max) { 5.GiB }
      let(:new_size) { 5.5.GiB }

      context "and align_type is nil" do
        let(:align_type) { nil }

        it "sets the size of the partition to the max" do
          partition.resize(new_size, align_type: align_type)
          expect(partition.size).to eq max
        end
      end

      context "and align_type is not nil" do
        let(:align_type) { optimal }

        context "and is possible to align whithin the resizing limits (min & max)" do
          it "sets the size of the partition to the max" do
            partition.resize(new_size, align_type: align_type)
            expect(partition.size).to eq max
          end
        end

        # Corner case, there is no single aligned point between min and max
        context "and is impossible to honor both the alignment and the resizing limits" do
          let(:min) { max - 700.KiB }

          it "sets the size of the partition to the max" do
            partition.resize(new_size, align_type: align_type)
            expect(partition.size).to eq max
          end
        end
      end
    end

    context "if the new size is smaller than the min resizing size" do
      let(:min) { 2.GiB }
      let(:new_size) { 1.GiB }

      context "and align_type is nil" do
        let(:align_type) { nil }

        it "sets the size of the partition to the min" do
          partition.resize(new_size, align_type: align_type)
          expect(partition.size).to eq min
        end
      end

      context "and align_type is not nil" do
        let(:align_type) { optimal }

        context "and is possible to align whithin the resizing limits (min & max)" do
          it "resizes the partition to the minimal aligned size" do
            partition.resize(new_size, align_type: align_type)

            expect(partition.size).to be > min
            expect(partition.size - min).to be < partition.partition_table.align_grain
            expect(partition.end_aligned?).to eq true
          end
        end

        # Corner case, there is no single aligned point between min and max
        context "and is impossible to honor both the alignment and the resizing limits" do
          let(:min) { max - 700.KiB }

          include_examples "keep original size"
        end
      end
    end

    context "if the new size is within the resizing limits (min & max)" do
      let(:new_size) { min + 64.KiB }

      # Corner case, there is no single aligned point between min and max
      context "but those limits make alignment impossible" do
        let(:min) { max - 700.KiB }
        let(:align_type) { optimal }

        include_examples "keep original size"
      end
    end
  end

  describe "#subsequent_slot?" do
    let(:disk) { fake_devicegraph.find_by_name(disk_name) }
    let(:region) { disk.partition_table.unused_partition_slots[slot].region }
    let(:slot) { 0 }
    let(:space) { Y2Storage::FreeDiskSpace.new(disk, region) }
    subject(:partition) { fake_devicegraph.find_by_name(part_name) }

    context "when the space starts at the sector right after the partition" do
      let(:scenario) { "spaces_5_5_10" }
      let(:part_name) { "/dev/sda1" }
      let(:disk_name) { "/dev/sda" }

      it "returns true" do
        expect(partition.subsequent_slot?(space)).to eq true
      end
    end

    context "when the space is right after a partition with missaligned end" do
      let(:scenario) { "alignment" }
      let(:part_name) { "/dev/sdb1" }
      let(:disk_name) { "/dev/sdb" }

      it "returns true" do
        expect(partition.subsequent_slot?(space)).to eq true
      end
    end

    context "when the space is not adyacent to the partition" do
      let(:scenario) { "spaces_5_5_10" }
      let(:part_name) { "/dev/sda1" }
      let(:disk_name) { "/dev/sda" }
      let(:slot) { 1 }

      it "returns false" do
        expect(partition.subsequent_slot?(space)).to eq false
      end
    end

    context "when the space starts at an appropriate sector but is in another disk" do
      let(:scenario) { "alignment" }
      let(:part_name) { "/dev/sdb1" }
      let(:disk_name) { "/dev/sdc" }

      it "returns false" do
        expect(partition.subsequent_slot?(space)).to eq false
      end
    end
  end

  # Only basic cases are tested here. More exhaustive tests can be found in tests
  # for Y2Storage::MatchVolumeSpec
  describe "#match_volume?" do
    let(:scenario) { "windows-linux-free-pc" }

    subject(:partition) { Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/sda2") }

    let(:volume) { Y2Storage::VolumeSpecification.new({}) }

    before do
      volume.mount_point = volume_mount_point
      volume.partition_id = volume_partition_id
      volume.fs_types = volume_fs_types
      volume.min_size = volume_min_size

      partition.filesystem.mount_path = "swap"
    end

    context "when the partition has the same values than the volume" do
      let(:volume_mount_point) { "swap" }
      let(:volume_partition_id) { Y2Storage::PartitionId::SWAP }
      let(:volume_fs_types) { [Y2Storage::Filesystems::Type::SWAP] }
      let(:volume_min_size) { Y2Storage::DiskSize.GiB(2) }

      it "returns true" do
        expect(partition.match_volume?(volume)).to eq(true)
      end
    end

    context "when the partition has different values than the volume" do
      let(:volume_mount_point) { "/boot" }
      let(:volume_partition_id) { Y2Storage::PartitionId::ESP }
      let(:volume_fs_types) { [Y2Storage::Filesystems::Type::VFAT] }
      let(:volume_min_size) { Y2Storage::DiskSize.GiB(3) }

      it "returns false" do
        expect(partition.match_volume?(volume)).to eq(false)
      end
    end
  end

  describe "#implicit?" do
    subject { fake_devicegraph.find_by_name(device_name) }

    let(:scenario) { "several-dasds" }

    context "when the partition belongs to an implicit partition table" do
      let(:device_name) { "/dev/dasda1" }

      it "returns true" do
        expect(subject.implicit?).to eq(true)
      end
    end

    context "when the partition does not belong to an implicit partition table" do
      let(:device_name) { "/dev/dasdc1" }

      it "returns false" do
        expect(subject.implicit?).to eq(false)
      end
    end
  end

  describe "#swap?" do
    let(:scenario) { "windows-linux-free-pc" }

    subject(:partition) { fake_devicegraph.find_by_name(device_name) }

    context "when does not have a swap id" do
      let(:device_name) { "/dev/sda3" }

      it "returns false" do
        expect(subject.swap?).to eq(false)
      end
    end

    context "when has a swap id" do
      let(:device_name) { "/dev/sda2" }

      context "and it is formatted as swap" do
        it "returns true" do
          expect(subject.swap?).to eq(true)
        end
      end

      context "but it is not formatted as swap" do
        before do
          subject.remove_descendants
          subject.create_filesystem(Y2Storage::Filesystems::Type::VFAT)
        end

        it "returns false" do
          expect(subject.swap?).to eq(false)
        end
      end
    end
  end

  describe "#windows_suitable?" do
    subject(:partition) { fake_devicegraph.find_by_name(device_name) }

    before do
      partition.id = id
    end

    let(:id) { Y2Storage::PartitionId::LINUX }

    context "when the partition does not belongs to a disk" do
      let(:scenario) { "partitioned_md" }

      let(:device_name) { "/dev/md0p1" }

      it "returns false" do
        expect(subject.windows_suitable?).to eq(false)
      end
    end

    context "when the partition belongs to a disk" do
      let(:scenario) { "mixed_disks" }

      context "but it is not a primary partition" do
        let(:device_name) { "/dev/sdb5" }

        it "returns false" do
          expect(subject.windows_suitable?).to eq(false)
        end
      end

      context "and it is a primary partition" do
        let(:device_name) { "/dev/sda1" }

        context "and it has 'windows_system' id" do
          let(:id) { Y2Storage::PartitionId::NTFS }

          it "returns true" do
            expect(subject.windows_suitable?).to eq(true)
          end
        end

        context "and it has no 'windows_system' id" do
          let(:id) { Y2Storage::PartitionId::LVM }

          it "returns false" do
            expect(subject.windows_suitable?).to eq(false)
          end
        end
      end
    end
  end

  describe "#efi_system?" do
    let(:scenario) { "efi_not_mounted" }

    subject(:partition) { fake_devicegraph.find_by_name(device_name) }

    context "when does have an EFI System id" do
      let(:device_name) { "/dev/sda1" }

      context "and it is formatted as VFAT" do
        it "returns true" do
          expect(subject.efi_system?).to eq(true)
        end
      end

      context "and it is not formatted as VFAT" do
        before do
          subject.delete_filesystem
          subject.create_filesystem(Y2Storage::Filesystems::Type::EXT4)
        end

        it "returns false" do
          expect(subject.efi_system?).to eq(false)
        end
      end
    end

    context "when does not have an EFI System id" do
      let(:device_name) { "/dev/sda2" }

      it "returns false" do
        expect(subject.efi_system?).to eq(false)
      end
    end
  end
end
