# frozen_string_literal: true

# Copyright (c) [2023-2025] SUSE LLC
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
require "agama/dbus/storage/volume_conversion/to_dbus"
require "agama/storage/volume"
require "y2storage/filesystems/type"
require "y2storage/disk_size"

describe Agama::DBus::Storage::VolumeConversion::ToDBus do
  let(:volume1) { Agama::Storage::Volume.new("/test1") }

  let(:volume2) do
    Agama::Storage::Volume.new("/test2").tap do |volume|
      volume.min_size = nil
      volume.max_size = nil
      volume.auto_size = true
      volume.outline.base_min_size = Y2Storage::DiskSize.new(1024)
      volume.outline.base_max_size = Y2Storage::DiskSize.new(4096)
    end
  end

  let(:volume3) do
    volume_outline = Agama::Storage::VolumeOutline.new.tap do |outline|
      outline.required = true
      outline.filesystems = [Y2Storage::Filesystems::Type::EXT3, Y2Storage::Filesystems::Type::EXT4]
      outline.adjust_by_ram = true
      outline.min_size_fallback_for = ["/", "/home"]
      outline.max_size_fallback_for = ["swap"]
      outline.snapshots_configurable = true
      outline.snapshots_size = Y2Storage::DiskSize.new(1000)
      outline.snapshots_percentage = 10
      outline.adjust_by_ram = true
      outline.base_min_size = Y2Storage::DiskSize.new(2048)
      outline.base_max_size = Y2Storage::DiskSize.new(4096)
    end

    Agama::Storage::Volume.new("/test3").tap do |volume|
      volume.outline = volume_outline
      volume.fs_type = Y2Storage::Filesystems::Type::EXT4
      volume.btrfs.snapshots = true
      volume.btrfs.read_only = true
      volume.mount_options = ["rw", "default"]
      volume.location.device = "/dev/sda"
      volume.location.target = :new_partition
      volume.min_size = Y2Storage::DiskSize.new(1024)
      volume.max_size = Y2Storage::DiskSize.new(2048)
      volume.auto_size = true
    end
  end

  describe "#convert" do
    it "converts the volume to a D-Bus hash" do
      expect(described_class.new(volume1).convert).to eq(
        "MountPath"     => "/test1",
        "MountOptions"  => [],
        "TargetDevice"  => "",
        "Target"        => "default",
        "FsType"        => "",
        "MinSize"       => 0,
        "AutoSize"      => false,
        "Snapshots"     => false,
        "Transactional" => false,
        "Outline"       => {
          "Required"              => false,
          "FsTypes"               => [],
          "SupportAutoSize"       => false,
          "AdjustByRam"           => false,
          "SnapshotsConfigurable" => false,
          "SnapshotsAffectSizes"  => false,
          "SizeRelevantVolumes"   => []
        }
      )

      expect(described_class.new(volume2).convert).to eq(
        "MountPath"     => "/test2",
        "MountOptions"  => [],
        "TargetDevice"  => "",
        "Target"        => "default",
        "FsType"        => "",
        "MinSize"       => 1024,
        "MaxSize"       => 4096,
        "AutoSize"      => true,
        "Snapshots"     => false,
        "Transactional" => false,
        "Outline"       => {
          "Required"              => false,
          "FsTypes"               => [],
          "SupportAutoSize"       => false,
          "AdjustByRam"           => false,
          "SnapshotsConfigurable" => false,
          "SnapshotsAffectSizes"  => false,
          "SizeRelevantVolumes"   => []
        }
      )

      expect(described_class.new(volume3).convert).to eq(
        "MountPath"     => "/test3",
        "MountOptions"  => ["rw", "default"],
        "TargetDevice"  => "/dev/sda",
        "Target"        => "new_partition",
        "FsType"        => "ext4",
        "MinSize"       => 2048,
        "MaxSize"       => 4096,
        "AutoSize"      => true,
        "Snapshots"     => true,
        "Transactional" => true,
        "Outline"       => {
          "Required"              => true,
          "FsTypes"               => ["ext3", "ext4"],
          "AdjustByRam"           => true,
          "SupportAutoSize"       => true,
          "SnapshotsConfigurable" => true,
          "SnapshotsAffectSizes"  => true,
          "SizeRelevantVolumes"   => ["/", "/home", "swap"]
        }
      )
    end
  end
end
