#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2016] SUSE LLC
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

describe Y2Storage::Planned::AssignedSpace do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  def partition(mount_point, size, min_size, max_size)
    res = Y2Storage::Planned::Partition.new(mount_point)
    res.size = size
    res.min = min_size
    res.max = max_size
    res
  end

  # FIXME: this is testing a private method (test moved from the old
  # PlannedVolumesList). So this should be replaced by tests verifying the order
  # using just the public API
  describe "#partitions_sorted_by_attr" do
    subject { described_class.new(space, []) }

    before do
      allow(subject).to receive(:partitions).and_return [part1, part2, part3, part4]
    end

    let(:space) do
      double("Y2Storage::FreeDiskSpace",
        disk:                   disk,
        disk_size:              500.GiB,
        align_grain:            1.MiB,
        require_end_alignment?: false)
    end

    let(:disk) { double("Y2Storage::Disk") }

    let(:part1) { partition("/p1", 100.MiB, 1.GiB, 2.GiB) }
    let(:part2) { partition("/p2", nil,     1.GiB, 2.GiB) }
    let(:part3) { partition("/p3", 100.GiB, 2.GiB, 4.GiB) }
    let(:part4) { partition("/p4", nil,     1.GiB, 3.GiB) }

    it "returns an array" do
      expect(subject.send(:partitions_sorted_by_attr, :size)).to be_a Array
    end

    it "raises an error if the attribute does not exists" do
      expect { subject.send(:partitions_sorted_by_attr, :none) }.to raise_error NoMethodError
    end

    it "sorts ascending with nils at the end by default" do
      expect(subject.send(:partitions_sorted_by_attr, :size).map(&:size))
        .to eq [100.MiB, 100.GiB, nil, nil]
    end

    it "can sort in descending order" do
      expect(subject.send(:partitions_sorted_by_attr, :size, descending: true).map(&:size))
        .to eq [100.GiB, 100.MiB, nil, nil]
    end

    it "can sort nils at start" do
      expect(subject.send(:partitions_sorted_by_attr, :size, nils_first: true).map(&:size))
        .to eq [nil, nil, 100.MiB, 100.GiB]
    end

    it "uses the next attribute in the list to break ties" do
      result = subject.send(:partitions_sorted_by_attr, :min, :max, :size, nils_first: true)
      expect(result).to eq [part2, part1, part4, part3]
    end

    it "respects the original order in case of full tie" do
      expect(subject.send(:partitions_sorted_by_attr, :min_size)).to eq(
        [part1, part2, part4, part3]
      )
    end
  end

  # FIXME: same than above, testing a private method (same reason)
  describe "#enforced_last" do
    subject { described_class.new(space, []) }

    before do
      allow(subject).to receive(:partitions).and_return partitions
    end

    let(:space) do
      double("Y2Storage::FreeDiskSpace", disk: disk, disk_size: size, align_grain: align_grain)
    end

    let(:space) do
      double("Y2Storage::FreeDiskSpace",
        disk:                   disk,
        disk_size:              size,
        align_grain:            align_grain,
        require_end_alignment?: end_alignment)
    end

    let(:disk) { double("Y2Storage::Disk") }
    let(:size) { 50.MiB }
    let(:align_grain) { 512.KiB }
    let(:end_alignment) { false }

    let(:partitions) { [big_part1, small_part1, big_part2] }

    let(:big_part1) { planned_vol(type: :vfat, min: 10.MiB) }
    let(:big_part2) { planned_vol(type: :vfat, min: 10.MiB) }
    let(:small_part1) { planned_vol(type: :vfat, min: 1.MiB + 512.KiB) }
    let(:small_part2) { planned_vol(type: :vfat, min: 1.MiB + 512.KiB) }

    context "if end-alignment is required" do
      let(:end_alignment) { true }

      it "returns nil" do
        expect(subject.send(:enforced_last)).to be_nil
      end
    end

    context "if all the partitions are divisible by align_grain" do
      let(:size) { 21.MiB + 512.KiB }
      let(:align_grain) { 512.KiB }

      it "returns nil" do
        expect(subject.send(:enforced_last)).to be_nil
      end
    end

    context "if the space is big enough for any order" do
      let(:size) { 22.MiB }
      let(:align_grain) { 1.MiB }

      it "returns nil" do
        expect(subject.send(:enforced_last)).to be_nil
      end
    end

    context "if the partitions do not fit into the space" do
      let(:size) { 21.MiB }
      let(:align_grain) { 1.MiB }

      it "returns nil" do
        expect(subject.send(:enforced_last)).to be_nil
      end
    end

    context "if a given partition must be placed at the end" do
      let(:size) { 21.MiB + 512.KiB }
      let(:align_grain) { 1.MiB }

      it "returns the choosen partition" do
        expect(subject.send(:enforced_last)).to eq small_part1
      end
    end

    context "if several partitions could be placed at the end" do
      let(:partitions) { [big_part1, small_part1, small_part2, big_part2] }

      let(:size) { 23.MiB + 512.KiB }
      let(:align_grain) { 1.MiB }

      it "returns the last partition that fits at the end" do
        expect(subject.send(:enforced_last)).to eq small_part2
      end
    end
  end

  describe "#update_disk_space" do
    before { fake_scenario("mixed_disks") }
    let(:disk) { fake_devicegraph.find_by_name("/dev/sda") }
    subject(:assigned) { described_class.new(disk.free_spaces.first, []) }

    it "refreshes all the information related to the available space" do
      expect(assigned.region.start).to eq 209717248
      expect(assigned.disk_size).to eq 2.GiB

      disk.partition_table.create_partition(
        "/dev/sda3",
        Y2Storage::Region.create(assigned.region.start, 1048576, 512),
        Y2Storage::PartitionType::PRIMARY
      )
      assigned.update_disk_space

      expect(assigned.region.start).to eq(209717248 + 1048576)
      expect(assigned.disk_size).to eq 1.5.GiB
    end
  end
end
