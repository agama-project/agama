# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
require "y2storage/filesystems/type"
require "y2storage/disk_size"
require "agama/dbus/storage/volume_conversion/to_dbus"
require "agama/storage/volume"

describe Agama::DBus::Storage::VolumeConversion::ToDBus do
  let(:default_volume) { Agama::Storage::Volume.new("/test") }

  let(:custom_volume) do
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
    end

    Agama::Storage::Volume.new("/test").tap do |volume|
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
      expect(described_class.new(default_volume).convert).to eq(
        "MountPath"     => "/test",
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

      expect(described_class.new(custom_volume).convert).to eq(
        "MountPath"     => "/test",
        "MountOptions"  => ["rw", "default"],
        "TargetDevice"  => "/dev/sda",
        "Target"        => "new_partition",
        "FsType"        => "Ext4",
        "MinSize"       => 1024,
        "MaxSize"       => 2048,
        "AutoSize"      => true,
        "Snapshots"     => true,
        "Transactional" => true,
        "Outline"       => {
          "Required"              => true,
          "FsTypes"               => ["Ext3", "Ext4"],
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
