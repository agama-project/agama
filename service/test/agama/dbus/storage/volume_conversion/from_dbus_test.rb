# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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
require_relative "../../../rspec/matchers/storage"
require "agama/config"
require "agama/storage/volume"
require "agama/storage/volume_templates_builder"
require "agama/dbus/storage/volume_conversion/from_dbus"

describe Agama::DBus::Storage::VolumeConversion::FromDBus do
  subject { described_class.new(dbus_volume, config: config) }

  let(:config) { Agama::Config.new(config_data) }

  let(:config_data) do
    {
      "storage" => {
        "volume_templates" => [
          {
            "mount_path"    => "/test",
            "mount_options" => ["data=ordered"],
            "filesystem"    => "btrfs",
            "size"          => {
              "auto" => false,
              "min"  => "5 GiB",
              "max"  => "10 GiB"
            },
            "btrfs"         => {
              "snapshots" => false
            },
            "outline"       => outline
          }
        ]
      }
    }
  end

  let(:outline) do
    {
      "filesystems"            => ["xfs", "ext3", "ext4"],
      "snapshots_configurable" => true
    }
  end

  let(:logger) { Logger.new($stdout, level: :warn) }

  describe "#convert" do
    let(:dbus_volume) do
      {
        "MountPath"    => "/test",
        "MountOptions" => ["rw", "default"],
        "TargetDevice" => "/dev/sda",
        "Target"       => "new_vg",
        "FsType"       => "Ext4",
        "MinSize"      => 1024,
        "MaxSize"      => 2048,
        "AutoSize"     => false,
        "Snapshots"    => true
      }
    end

    it "generates a volume with the expected outline from the config" do
      volume = subject.convert
      default_volume = Agama::Storage::VolumeTemplatesBuilder.new_from_config(config).for("/test")

      expect(volume.outline).to eq_outline(default_volume.outline)
    end

    it "generates a volume with the values provided from D-Bus" do
      volume = subject.convert

      expect(volume).to be_a(Agama::Storage::Volume)
      expect(volume.mount_path).to eq("/test")
      expect(volume.mount_options).to contain_exactly("rw", "default")
      expect(volume.location.device).to eq("/dev/sda")
      expect(volume.location.target).to eq(:new_vg)
      expect(volume.fs_type).to eq(Y2Storage::Filesystems::Type::EXT4)
      expect(volume.auto_size?).to eq(false)
      expect(volume.min_size.to_i).to eq(1024)
      expect(volume.max_size.to_i).to eq(2048)
      expect(volume.btrfs.snapshots).to eq(true)
    end

    context "when some values are not provided from D-Bus" do
      let(:dbus_volume) { { "MountPath" => "/test" } }

      it "completes missing values with default values from the config" do
        volume = subject.convert

        expect(volume).to be_a(Agama::Storage::Volume)
        expect(volume.mount_path).to eq("/test")
        expect(volume.mount_options).to contain_exactly("data=ordered")
        expect(volume.location.target).to eq :default
        expect(volume.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
        expect(volume.auto_size?).to eq(false)
        expect(volume.min_size.to_i).to eq(5 * (1024**3))
        # missing maximum value means unlimited size
        expect(volume.max_size.to_i).to eq(-1)
        expect(volume.btrfs.snapshots?).to eq(false)
      end
    end

    context "when the D-Bus settings include changes in the volume outline" do
      let(:outline) { { "required" => true } }

      let(:dbus_volume) do
        {
          "MountPath" => "/test",
          "Outline"   => {
            "Required" => false
          }
        }
      end

      it "ignores the outline values provided from D-Bus" do
        volume = subject.convert

        expect(volume.outline.required?).to eq(true)
      end
    end

    context "when the D-Bus settings provide AutoSize value for a supported volume" do
      let(:outline) do
        {
          "auto_size" => {
            "min_fallback_for" => ["/"]
          }
        }
      end

      let(:dbus_volume) do
        {
          "MountPath" => "/test",
          "AutoSize"  => true
        }
      end

      it "sets the AutoSize value provided from D-Bus" do
        volume = subject.convert

        expect(volume.auto_size?).to eq(true)
      end
    end

    context "when the D-Bus settings provide AutoSize for an unsupported volume" do
      let(:outline) { {} }

      let(:dbus_volume) do
        {
          "MountPath" => "/test",
          "AutoSize"  => true
        }
      end

      it "ignores the AutoSize value provided from D-Bus" do
        volume = subject.convert

        expect(volume.auto_size?).to eq(false)
      end
    end

    context "when the D-Bus settings provide a FsType listed in the outline" do
      let(:outline) { { "filesystems" => ["btrfs", "ext4"] } }

      let(:dbus_volume) do
        {
          "MountPath" => "/test",
          "FsType"    => "ext4"
        }
      end

      it "sets the FsType value provided from D-Bus" do
        volume = subject.convert

        expect(volume.fs_type).to eq(Y2Storage::Filesystems::Type::EXT4)
      end
    end

    context "when the D-Bus settings provide a FsType not listed in the outline" do
      let(:outline) { { "filesystems" => ["btrfs"] } }

      let(:dbus_volume) do
        {
          "MountPath" => "/test",
          "FsType"    => "ext4"
        }
      end

      it "ignores the FsType value provided from D-Bus" do
        volume = subject.convert

        expect(volume.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
      end
    end

    context "when the D-Bus settings provide Snapshots for a supported volume" do
      let(:outline) { { "snapshots_configurable" => true } }

      let(:dbus_volume) do
        {
          "MountPath" => "/test",
          "Snapshots" => true
        }
      end

      it "sets the Snapshots value provided from D-Bus" do
        volume = subject.convert

        expect(volume.btrfs.snapshots?).to eq(true)
      end
    end

    context "when the D-Bus settings provide Snapshots for an unsupported volume" do
      let(:outline) { { "snapshots_configurable" => false } }

      let(:dbus_volume) do
        {
          "MountPath" => "/test",
          "Snapshots" => true
        }
      end

      it "ignores the Snapshots value provided from D-Bus" do
        volume = subject.convert

        expect(volume.btrfs.snapshots?).to eq(false)
      end
    end

    context "when the D-Bus settings provide a Target that makes no sense" do
      let(:dbus_volume) do
        {
          "MountPath" => "/test",
          "Target"    => "new_disk"
        }
      end

      it "ignores the Target value provided from D-Bus and uses :default" do
        volume = subject.convert

        expect(volume.location.target).to eq :default
      end
    end
  end
end
