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

require_relative "../../../test_helper"
require "agama/storage/volume_conversions/to_json"
require "agama/storage/volume"
require "y2storage/filesystems/type"
require "y2storage/disk_size"

describe Agama::Storage::VolumeConversions::ToJSON do
  let(:default_volume) { Agama::Storage::Volume.new("/test") }

  let(:custom_volume1) do
    Agama::Storage::Volume.new("/test").tap do |volume|
      volume.fs_type = Y2Storage::Filesystems::Type::XFS
      volume.auto_size = true
    end
  end

  let(:custom_volume2) do
    Agama::Storage::Volume.new("/test").tap do |volume|
      volume.fs_type = Y2Storage::Filesystems::Type::BTRFS
      volume.btrfs.snapshots = true
      volume.mount_options = ["rw", "default"]
      volume.location.device = "/dev/sda"
      volume.location.target = :new_partition
      volume.min_size = Y2Storage::DiskSize.new(1024)
      volume.max_size = Y2Storage::DiskSize.new(2048)
    end
  end

  describe "#convert" do
    it "converts the volume to a JSON hash according to schema" do
      # @todo Check whether the result matches the JSON schema.

      expect(described_class.new(default_volume).convert).to eq(
        mountPath:    "/test",
        mountOptions: [],
        fsType:       "",
        minSize:      0,
        autoSize:     false,
        outline:      {
          required:             false,
          fsTypes:              [],
          supportAutoSize:      false,
          adjustByRam:          false,
          snapshotsAffectSizes: false,
          sizeRelevantVolumes:  []
        }
      )

      expect(described_class.new(custom_volume1).convert).to eq(
        mountPath:    "/test",
        mountOptions: [],
        fsType:       "xfs",
        minSize:      0,
        autoSize:     true,
        outline:      {
          required:             false,
          fsTypes:              [],
          supportAutoSize:      false,
          adjustByRam:          false,
          snapshotsAffectSizes: false,
          sizeRelevantVolumes:  []
        }
      )

      expect(described_class.new(custom_volume2).convert).to eq(
        mountPath:    "/test",
        mountOptions: ["rw", "default"],
        fsType:       "btrfsSnapshots",
        minSize:      1024,
        maxSize:      2048,
        autoSize:     false,
        outline:      {
          required:             false,
          fsTypes:              [],
          supportAutoSize:      false,
          adjustByRam:          false,
          snapshotsAffectSizes: false,
          sizeRelevantVolumes:  []
        }
      )
    end

    context "if btrfs snapshots can be configured" do
      let(:volume) do
        Agama::Storage::Volume.new("/").tap do |volume|
          volume.fs_type = Y2Storage::Filesystems::Type::BTRFS
          volume.auto_size = true
          volume.btrfs.snapshots = true
          volume.outline = Agama::Storage::VolumeOutline.new.tap do |outline|
            outline.filesystems = [
              Y2Storage::Filesystems::Type::XFS, Y2Storage::Filesystems::Type::BTRFS
            ]
            outline.snapshots_configurable = true
          end
        end
      end

      it "includes all the expected filesystem types" do
        converted = described_class.new(volume).convert
        expect(converted[:outline][:fsTypes]).to contain_exactly("xfs", "btrfs", "btrfsSnapshots")
      end

      it "sets the correct default filesystem type" do
        converted = described_class.new(volume).convert
        expect(converted[:fsType]).to eq "btrfsSnapshots"
      end
    end

    context "if btrfs snapshots are mandatory" do
      let(:volume) do
        Agama::Storage::Volume.new("/").tap do |volume|
          volume.fs_type = Y2Storage::Filesystems::Type::BTRFS
          volume.auto_size = true
          volume.btrfs.snapshots = true
          volume.outline = Agama::Storage::VolumeOutline.new.tap do |outline|
            outline.filesystems = [
              Y2Storage::Filesystems::Type::XFS, Y2Storage::Filesystems::Type::BTRFS
            ]
            outline.snapshots_configurable = false
          end
        end
      end

      it "includes all the expected filesystem types" do
        converted = described_class.new(volume).convert
        expect(converted[:outline][:fsTypes]).to contain_exactly("xfs", "btrfsSnapshots")
      end

      it "sets the correct default filesystem type" do
        converted = described_class.new(volume).convert
        expect(converted[:fsType]).to eq "btrfsSnapshots"
      end
    end

    context "if btrfs snapshots cannot be enabled" do
      let(:volume) do
        Agama::Storage::Volume.new("/").tap do |volume|
          volume.fs_type = Y2Storage::Filesystems::Type::BTRFS
          volume.auto_size = true
          volume.btrfs.snapshots = false
          volume.outline = Agama::Storage::VolumeOutline.new.tap do |outline|
            outline.filesystems = [
              Y2Storage::Filesystems::Type::XFS, Y2Storage::Filesystems::Type::BTRFS
            ]
            outline.snapshots_configurable = false
          end
        end
      end

      it "includes all the expected filesystem types" do
        converted = described_class.new(volume).convert
        expect(converted[:outline][:fsTypes]).to contain_exactly("xfs", "btrfs")
      end

      it "sets the correct default filesystem type" do
        converted = described_class.new(volume).convert
        expect(converted[:fsType]).to eq "btrfs"
      end
    end

    context "if the system is configured as immutable" do
      let(:volume) do
        Agama::Storage::Volume.new("/").tap do |volume|
          volume.fs_type = Y2Storage::Filesystems::Type::BTRFS
          volume.auto_size = true
          volume.btrfs.read_only = true
          volume.btrfs.snapshots = true
          volume.outline = Agama::Storage::VolumeOutline.new.tap do |outline|
            outline.filesystems = [
              Y2Storage::Filesystems::Type::XFS, Y2Storage::Filesystems::Type::BTRFS
            ]
          end
        end
      end

      it "includes all the expected filesystem types" do
        converted = described_class.new(volume).convert
        expect(converted[:outline][:fsTypes]).to contain_exactly("xfs", "btrfsImmutable")
      end

      it "sets the correct default filesystem type" do
        converted = described_class.new(volume).convert
        expect(converted[:fsType]).to eq "btrfsImmutable"
      end
    end
  end
end
