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
require_relative "../../rspec/matchers/storage"
require "agama/config"
require "agama/storage/volume"
require "agama/storage/volume_templates_builder"
require "agama/storage/volume_conversions/from_json"
require "y2storage/disk_size"

def default_volume(mount_path)
  Agama::Storage::VolumeTemplatesBuilder.new_from_config(config).for(mount_path)
end

describe Agama::Storage::VolumeConversions::FromJSON do
  subject { described_class.new(volume_json, config: config) }

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

  describe "#convert" do
    let(:volume_json) do
      {
        mount:      {
          path:    "/test",
          options: ["rw", "default"]
        },
        target:     {
          newVg: "/dev/sda"
        },
        filesystem: "ext4",
        size:       {
          min: 1024,
          max: 2048
        }
      }
    end

    it "generates a volume with the expected outline from JSON" do
      volume = subject.convert

      expect(volume.outline).to eq_outline(default_volume("/test").outline)
    end

    it "generates a volume with the values provided from JSON" do
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
      expect(volume.btrfs.snapshots).to eq(false)
    end

    context "when the JSON is missing some values" do
      let(:volume_json) do
        {
          mount: {
            path: "/test"
          }
        }
      end

      it "completes the missing values with default values from the config" do
        volume = subject.convert

        expect(volume).to be_a(Agama::Storage::Volume)
        expect(volume.mount_path).to eq("/test")
        expect(volume.mount_options).to contain_exactly("data=ordered")
        expect(volume.location.target).to eq :default
        expect(volume.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
        expect(volume.auto_size?).to eq(false)
        expect(volume.min_size.to_i).to eq(5 * (1024**3))
        expect(volume.max_size.to_i).to eq(10 * (1024**3))
        expect(volume.btrfs.snapshots?).to eq(false)
      end
    end

    context "when the JSON does not indicate max size" do
      let(:volume_json) do
        {
          mount: {
            path: "/test"
          },
          size:  {
            min: 1024
          }
        }
      end

      it "generates a volume with unlimited max size" do
        volume = subject.convert

        expect(volume.max_size).to eq(Y2Storage::DiskSize.unlimited)
      end
    end

    context "when the JSON indicates auto size for a supported volume" do
      let(:outline) do
        {
          "auto_size" => {
            "min_fallback_for" => ["/"]
          }
        }
      end

      let(:volume_json) do
        {
          mount: {
            path: "/test"
          },
          size:  "auto"
        }
      end

      it "generates a volume with auto size" do
        volume = subject.convert

        expect(volume.auto_size?).to eq(true)
      end
    end

    context "when the JSON indicates auto size for an unsupported volume" do
      let(:outline) { {} }

      let(:volume_json) do
        {
          mount: {
            path: "/test"
          },
          size:  "auto"
        }
      end

      it "ignores the auto size setting" do
        volume = subject.convert

        expect(volume.auto_size?).to eq(false)
      end
    end

    context "when the JSON indicates a filesystem included in the outline" do
      let(:outline) { { "filesystems" => ["btrfs", "ext4"] } }

      let(:volume_json) do
        {
          mount:      {
            path: "/test"
          },
          filesystem: "ext4"
        }
      end

      it "generates a volume with the indicated filesystem" do
        volume = subject.convert

        expect(volume.fs_type).to eq(Y2Storage::Filesystems::Type::EXT4)
      end
    end

    context "when the JSON indicates a filesystem not included in the outline" do
      let(:outline) { { "filesystems" => ["btrfs"] } }

      let(:volume_json) do
        {
          mount:      {
            path: "/test"
          },
          filesystem: "ext4"
        }
      end

      it "ignores the filesystem setting" do
        volume = subject.convert

        expect(volume.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
      end
    end

    context "when the JSON indicates snapshots for a supported volume" do
      let(:outline) { { "snapshots_configurable" => true } }

      let(:volume_json) do
        {
          mount:      {
            path: "/test"
          },
          filesystem: {
            btrfs: {
              snapshots: true
            }
          }
        }
      end

      it "generates a volume with snapshots" do
        volume = subject.convert

        expect(volume.btrfs.snapshots?).to eq(true)
      end
    end

    context "when the JSON indicates snapshots for an unsupported volume" do
      let(:outline) { { "snapshots_configurable" => false } }

      let(:volume_json) do
        {
          mount:      {
            path: "/test"
          },
          filesystem: {
            btrfs: {
              snapshots: true
            }
          }
        }
      end

      it "ignores the snapshots setting" do
        volume = subject.convert

        expect(volume.btrfs.snapshots?).to eq(false)
      end
    end
  end
end
