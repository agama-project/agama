#!/usr/bin/env rspec
#
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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"
require "y2storage/planned"

describe Y2Storage::Planned::LvmLv do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject(:lvm_lv) { described_class.new(mount_point) }

  let(:mount_point) { "/" }

  let(:volume_group) do
    instance_double(Y2Storage::LvmVg, size: 30.GiB, extent_size: 4.MiB, is?: false)
  end

  describe "#initialize" do
    context "when creating a planned lv for a given mount point" do
      context "and the mount point is '/'" do
        let(:mount_point) { "/" }

        it "sets lv name to 'root'" do
          expect(subject.logical_volume_name).to eq("root")
        end
      end

      context "and the mount point is not '/'" do
        let(:mount_point) { "/var/lib/docker" }

        it "sets lv name based on mount point" do
          expect(subject.logical_volume_name).to eq("var_lib_docker")
        end
      end
    end

    context "when creating a planned lv without mount point" do
      let(:mount_point) { nil }

      it "does not set lv name" do
        expect(subject.logical_volume_name).to be_nil
      end
    end
  end

  describe "#size_in" do
    let(:lv_size) { 10.GiB }

    before do
      lvm_lv.size = lv_size
    end

    it "returns the logical volume size" do
      expect(lvm_lv.size_in(volume_group)).to eq(lv_size)
    end

    context "when size is a percentage" do
      let(:container) { volume_group }

      before do
        lvm_lv.percent_size = 50
        allow(container).to receive(:is?).with(:lvm_lv).and_return(lvm_lv?)
      end

      context "and the logical volume is not a thin volume" do
        let(:lvm_lv?) { false }

        it "returns the size based on the volume group size" do
          expect(lvm_lv.size_in(container)).to eq(15.GiB)
        end
      end

      context "and the logical volume is a thin volume" do
        let(:lvm_lv?) { true }

        let(:container) do
          instance_double(
            Y2Storage::LvmLv, lv_type: Y2Storage::LvType::THIN_POOL, size: 10.GiB,
            lvm_vg: volume_group
          )
        end

        it "returns the size based on the thin pool size" do
          expect(lvm_lv.size_in(container)).to eq(5.GiB)
        end
      end
    end

    context "when it is a thin logical volume" do
      let(:thin_pool) do
        instance_double(Y2Storage::LvmLv, lv_type: Y2Storage::LvType::THIN_POOL, size: 30.GiB)
      end

      let(:lvm_lv) do
        planned_lv(lv_type: Y2Storage::LvType::THIN, thin_pool: thin_pool, max: lv_size)
      end

      context "and max size is limited" do
        let(:lv_size) { 5.GiB }

        it "returns max size" do
          expect(lvm_lv.size_in(thin_pool)).to eq(lvm_lv.max)
        end
      end

      context "and max size is not limited" do
        let(:lv_size) { Y2Storage::DiskSize.unlimited }

        it "returns thin pool size" do
          expect(lvm_lv.size_in(thin_pool)).to eq(thin_pool.size)
        end
      end
    end
  end

  # Only basic cases are tested here. More exhaustive tests can be found in tests
  # for Y2Storage::MatchVolumeSpec
  describe "match_volume?" do
    let(:volume) { Y2Storage::VolumeSpecification.new({}) }

    before do
      lvm_lv.min_size = min_size
      lvm_lv.filesystem_type = filesystem_type

      volume.mount_point = volume_mount_point
      volume.partition_id = volume_partition_id
      volume.fs_types = volume_fs_types
      volume.min_size = volume_min_size
    end

    let(:volume_mount_point) { "/boot" }
    let(:volume_partition_id) { nil }
    let(:volume_fs_types) { [Y2Storage::Filesystems::Type::EXT2] }
    let(:volume_min_size) { 1.GiB }

    context "when the planned lv has the same values" do
      let(:mount_point) { volume_mount_point }
      let(:filesystem_type) { volume_fs_types.first }
      let(:min_size) { volume_min_size }

      it "returns true" do
        expect(lvm_lv.match_volume?(volume)).to eq(true)
      end

      context "but the volume requires a specific partition id" do
        let(:volume_partition_id) { Y2Storage::PartitionId::ESP }

        it "returns false" do
          expect(lvm_lv.match_volume?(volume)).to eq(false)
        end
      end
    end

    context "when the planned lv does not have the same values" do
      let(:mount_point) { "/boot/efi" }
      let(:filesystem_type) { Y2Storage::Filesystems::Type::VFAT }
      let(:min_size) { 2.GiB }

      it "returns false" do
        expect(lvm_lv.match_volume?(volume)).to eq(false)
      end
    end
  end

  describe "#add_thin_lv" do
    subject(:lvm_lv) { planned_lv(lv_type: Y2Storage::LvType::THIN_POOL) }
    let(:thin_lv) { planned_lv(lv_type: Y2Storage::LvType::THIN) }

    it "adds a thin lv to the thin pool lv" do
      lvm_lv.add_thin_lv(thin_lv)
      expect(lvm_lv.thin_lvs).to include(thin_lv)
    end

    it "points the thin lv to its pool" do
      lvm_lv.add_thin_lv(thin_lv)
      expect(thin_lv.thin_pool).to eq(lvm_lv)
    end

    context "when the argument is not a thin logical volume" do
      it "raises an ArgumentError exception" do
        expect { lvm_lv.add_thin_lv(lvm_lv) }.to raise_error(ArgumentError)
      end
    end
  end

  describe "#real_size_in" do
    subject(:lvm_lv) { planned_lv(lv_type: Y2Storage::LvType::THIN_POOL, size: 30.GiB) }

    before do
      allow(volume_group).to receive(:max_size_for_lvm_lv).with(lvm_lv.lv_type)
        .and_return(available_size)
    end

    context "when the available space is smaller than the planned size" do
      let(:available_size) { 20.GiB }

      it "returns the available size" do
        expect(lvm_lv.real_size_in(volume_group)).to eq(available_size)
      end
    end

    context "when the available space is greater than the planned size" do
      let(:available_size) { 40.GiB }

      it "returns the planned size" do
        expect(lvm_lv.real_size_in(volume_group)).to eq(lvm_lv.size)
      end
    end

    context "when available and planned sizes are equal" do
      let(:available_size) { 30.GiB }

      it "returns the planned size" do
        expect(lvm_lv.real_size_in(volume_group)).to eq(lvm_lv.size)
      end
    end
  end
end
