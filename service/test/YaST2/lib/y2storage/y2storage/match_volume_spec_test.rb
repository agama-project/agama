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

require "y2storage"

describe Y2Storage::MatchVolumeSpec do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  # Dummy class to test the mixin
  class Matcher
    include Y2Storage::MatchVolumeSpec

    def initialize(mount_point, partition_id, fs_type, size)
      @mount_point = mount_point
      @partition_id = partition_id
      @fs_type = fs_type
      @size = size
    end

  private

    def volume_match_values
      {
        mount_point:  @mount_point,
        partition_id: @partition_id,
        fs_type:      @fs_type,
        size:         @size
      }
    end
  end

  describe "#match_volume?" do
    subject(:matcher) { Matcher.new(mount_point, partition_id, fs_type, size) }

    let(:volume) { Y2Storage::VolumeSpecification.new({}) }

    before do
      volume.mount_point = volume_mount_point
      volume.partition_id = volume_partition_id
      volume.fs_types = volume_fs_types
      volume.min_size = volume_min_size
      volume.max_size_limit = volume_max_size_limit
    end

    let(:volume_mount_point) { "swap" }
    let(:volume_partition_id) { Y2Storage::PartitionId::SWAP }
    let(:volume_fs_types) { [Y2Storage::Filesystems::Type::SWAP, Y2Storage::Filesystems::Type::VFAT] }
    let(:volume_min_size) { Y2Storage::DiskSize.GiB(1) }
    let(:volume_max_size_limit) { Y2Storage::DiskSize.GiB(10) }

    context "when it has the same values than the volume" do
      let(:mount_point) { volume_mount_point }
      let(:partition_id) { volume_partition_id }
      let(:fs_type) { volume_fs_types.first }
      let(:size) { volume_min_size }

      it "returns true" do
        expect(matcher.match_volume?(volume)).to eq(true)
      end

      context "but it has different mount point" do
        let(:mount_point) { "/boot" }

        it "returns false" do
          expect(matcher.match_volume?(volume)).to eq(false)
        end

        context "and mount point is excluded for matching" do
          it "returns true" do
            expect(matcher.match_volume?(volume, exclude: :mount_point)).to eq(true)
          end
        end
      end

      context "and the size is bigger than volume min size" do
        let(:size) { volume_min_size + 1.GiB }

        context "and the size is smaller than the volume max size limit" do
          let(:size) { volume_min_size + 1.GiB }

          it "returns true" do
            expect(matcher.match_volume?(volume)).to eq(true)
          end
        end

        context "and the size is bigger than the volume max size limit" do
          let(:size) { volume_max_size_limit + 1.GiB }

          it "returns false" do
            expect(matcher.match_volume?(volume)).to eq(false)
          end
        end
      end

      context "but the size is less than volume min size" do
        let(:size) { volume_min_size - 10.MiB }

        it "returns false" do
          expect(matcher.match_volume?(volume)).to eq(false)
        end

        context "and size is excluded for matching" do
          it "returns true" do
            expect(matcher.match_volume?(volume, exclude: :size)).to eq(true)
          end
        end
      end

      context "but the size is nil" do
        let(:size) { nil }

        it "returns false" do
          expect(matcher.match_volume?(volume)).to eq(false)
        end

        context "and size is excluded for matching" do
          it "returns true" do
            expect(matcher.match_volume?(volume, exclude: :size)).to eq(true)
          end
        end
      end

      context "and fs type is included in the possible fs for the volume" do
        let(:fs_type) { Y2Storage::Filesystems::Type::SWAP }

        it "returns true" do
          expect(matcher.match_volume?(volume)).to eq(true)
        end
      end

      context "but fs type is not included in the possible fs for the volume" do
        let(:fs_type) { Y2Storage::Filesystems::Type::EXT2 }

        it "returns false" do
          expect(matcher.match_volume?(volume)).to eq(false)
        end

        context "and fs type is excluded for matching" do
          it "returns true" do
            expect(matcher.match_volume?(volume, exclude: :fs_type)).to eq(true)
          end
        end
      end

      context "and the volume does not require any specific fs" do
        let(:volume_fs_types) { [] }

        let(:fs_type) { Y2Storage::Filesystems::Type::EXT2 }

        it "returns true" do
          expect(matcher.match_volume?(volume)).to eq(true)
        end
      end

      context "but it has different partition id" do
        let(:partition_id) { Y2Storage::PartitionId::ESP }

        it "returns false" do
          expect(matcher.match_volume?(volume)).to eq(false)
        end

        context "and partition id is excluded for matching" do
          it "returns true" do
            expect(matcher.match_volume?(volume, exclude: :partition_id)).to eq(true)
          end
        end
      end

      context "and the volume does not require any specific partition id" do
        let(:volume_partition_id) { nil }

        let(:partition_id) { Y2Storage::PartitionId::ESP }

        it "returns true" do
          expect(matcher.match_volume?(volume)).to eq(true)
        end
      end
    end

    context "when it has different values than the volume" do
      let(:mount_point) { "/boot" }
      let(:partition_id) { Y2Storage::PartitionId::ESP }
      let(:fs_type) { [Y2Storage::Filesystems::Type::EXT2] }
      let(:size) { Y2Storage::DiskSize.MiB(100) }

      it "returns false" do
        expect(matcher.match_volume?(volume)).to eq(false)
      end

      context "but all values are excluded for matching" do
        let(:exclude) { [:mount_point, :partition_id, :fs_type, :size] }

        it "returns true" do
          expect(matcher.match_volume?(volume, exclude: exclude)).to eq(true)
        end
      end
    end
  end
end
