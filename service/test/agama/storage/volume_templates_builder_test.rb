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

require_relative "../../test_helper"
require_relative "storage_helpers"
require "agama/storage/volume_templates_builder"
require "agama/config"
require "y2storage"

describe Agama::Storage::VolumeTemplatesBuilder do
  include Agama::RSpec::StorageHelpers

  subject(:builder) { described_class.new_from_config(config) }

  let(:config) { Agama::Config.new(config_data) }

  let(:config_data) do
    { "storage" => { "volumes" => cfg_volumes, "volume_templates" => cfg_templates } }
  end

  let(:cfg_volumes) { ["/", "swap"] }

  let(:cfg_templates) { [root_template, other_template, swap_template, default_template] }
  let(:root_template) do
    {
      "mount_path" => "/", "filesystem" => "btrfs", "size" => { "auto" => true },
      "outline" => {
        "snapshots_configurable" => true, "required" => true,
        "auto_size"              => {
          "base_min" => "10 GiB", "base_max" => "20 GiB", "min_fallback_for" => ["/two"]
        }
      }
    }
  end
  let(:other_template) do
    {
      "mount_path" => "/two", "filesystem" => "xfs",
      "size" => { "auto" => false, "min" => "5 GiB" }
    }
  end
  let(:swap_template) do
    {
      "mount_path" => "swap", "filesystem" => "swap",
      "size" => { "auto" => false, "min" => "2 GiB", "max" => "4 GiB" }
    }
  end
  let(:default_template) do
    {
      "mount_path" => "", "filesystem" => "ext4", "size" => { "auto" => false }
    }
  end

  describe "#for" do
    it "returns a proper volume if the path is contained in the list of volume templates" do
      vol = builder.for("/")
      expect(vol).to be_a Agama::Storage::Volume
      expect(vol.mount_path).to eq "/"
      expect(vol.fs_type).to eq Y2Storage::Filesystems::Type::BTRFS
      expect(vol.auto_size?).to eq true
      expect(vol.auto_size_supported?).to eq true
      expect(vol.outline.required).to eq true
    end

    it "returns a default volume if the path is not in the list of volume templates" do
      vol = builder.for("/foo")
      expect(vol).to be_a Agama::Storage::Volume
      expect(vol.mount_path).to eq "/foo"
      expect(vol.fs_type).to eq Y2Storage::Filesystems::Type::EXT4
      expect(vol.auto_size?).to eq false
      expect(vol.auto_size_supported?).to eq false
      expect(vol.outline.required).to eq false
    end

    context "if size is not automatic" do
      it "sets the values for auto_size? and auto_size_supported?" do
        vol = builder.for("/two")
        expect(vol.auto_size?).to eq false
        expect(vol.auto_size_supported?).to eq false
      end

      it "sets the values for min_size and max_size" do
        vol = builder.for("swap")
        expect(vol.min_size).to eq Y2Storage::DiskSize::GiB(2)
        expect(vol.max_size).to eq Y2Storage::DiskSize::GiB(4)
      end

      it "sets the min_size to zero if the minimum is omitted in the configuration" do
        vol = builder.for("/foo")
        expect(vol.min_size).to eq Y2Storage::DiskSize.zero
      end

      it "sets the max_size to unlimited if the maximum is omitted in the configuration" do
        vol = builder.for("/foo")
        expect(vol.max_size).to eq Y2Storage::DiskSize.unlimited
      end
    end

    context "if size is automatic" do
      it "sets the values for auto_size? and auto_size_supported?" do
        vol = builder.for("/")
        expect(vol.auto_size?).to eq true
        expect(vol.auto_size_supported?).to eq true
      end

      it "sets the values for base_min_size and base_max_size" do
        vol = builder.for("/")
        expect(vol.outline.base_min_size).to eq Y2Storage::DiskSize::GiB(10)
        expect(vol.outline.base_max_size).to eq Y2Storage::DiskSize::GiB(20)
      end

      context "when no base min size is explicitly specified in the configuration" do
        let(:root_template) do
          {
            "mount_path" => "/", "filesystem" => "btrfs", "size" => { "auto" => true },
            "outline" => { "auto_size" => { "base_max" => "20 GiB" } }
          }
        end

        it "sets the base_min_size to zero" do
          vol = builder.for("/")
          expect(vol.outline.base_min_size).to eq Y2Storage::DiskSize.zero
        end
      end

      context "when no base max size is explicitly specified in the configuration" do
        let(:root_template) do
          {
            "mount_path" => "/", "filesystem" => "btrfs", "size" => { "auto" => true },
            "outline" => { "auto_size" => { "base_min" => "10 GiB" } }
          }
        end

        it "sets the base_min_size to zero" do
          vol = builder.for("/")
          expect(vol.outline.base_max_size).to eq Y2Storage::DiskSize.unlimited
        end
      end

      context "when snapshots_increment is provided as a size in the configuration" do
        let(:root_template) do
          {
            "mount_path" => "/", "filesystem" => "btrfs", "size" => { "auto" => true },
            "outline" => { "auto_size" => { "snapshots_increment" => "30 GiB" } }
          }
        end

        it "returns a volume with the corresponding value for snapshot_size" do
          vol = builder.for("/")
          expect(vol.outline.snapshots_size).to eq Y2Storage::DiskSize::GiB(30)
        end

        it "returns a volume with a nil snapshot_percentage" do
          vol = builder.for("/")
          expect(vol.outline.snapshots_percentage).to be_nil
        end
      end

      context "when snapshots_increment is provided as a percentage in the configuration" do
        let(:root_template) do
          {
            "mount_path" => "/", "filesystem" => "btrfs", "size" => { "auto" => true },
            "outline" => { "auto_size" => { "snapshots_increment" => "300%" } }
          }
        end

        it "returns a volume with the corresponding value for snapshot_percentage" do
          vol = builder.for("/")
          expect(vol.outline.snapshots_percentage).to eq 300
        end

        it "returns a volume with a nil snapshot_size" do
          vol = builder.for("/")
          expect(vol.outline.snapshots_size).to be_nil
        end
      end

      context "when there is no snapshots_increment in the configuration" do
        it "returns a volume with nil snapshot_size and snapshot_percentage" do
          vol = builder.for("/")
          expect(vol.outline.snapshots_size).to be_nil
          expect(vol.outline.snapshots_percentage).to be_nil
        end
      end
    end

    context "if the configuration includes Btrfs settings" do
      let(:root_template) do
        {
          "mount_path" => "/", "filesystem" => "btrfs", "size" => { "auto" => true },
          "btrfs" => btrfs_hash,
          "outline" => {
            "snapshots_configurable" => true, "required" => true,
            "auto_size"              => {
              "base_min" => "10 GiB", "base_max" => "20 GiB", "min_fallback_for" => ["/two"]
            }
          }
        }
      end

      let(:btrfs_hash) do
        {
          "snapshots" => true, "read_only" => true,
          "default_subvolume" => "@", "subvolumes" => subvolumes
        }
      end

      let(:subvolumes) { ["root", "home", "srv"] }

      it "it reads the settings" do
        vol = builder.for("/")
        expect(vol.btrfs.snapshots?).to eq true
        expect(vol.btrfs.read_only?).to eq true
        expect(vol.btrfs.default_subvolume).to eq "@"
        subvols = vol.btrfs.subvolumes
        expect(subvols.size).to eq 3
        expect(subvols).to all be_a(Y2Storage::SubvolSpecification)
        expect(subvols.map(&:path)).to contain_exactly("home", "root", "srv")
      end

      context "when no default subvolume is explicitly specified in the configuration" do
        let(:btrfs_hash) { { "snapshots" => false, "subvolumes" => subvolumes } }

        it "sets the default subvolume to the empty string" do
          vol = builder.for("/")
          expect(vol.btrfs.default_subvolume).to eq ""
        end
      end

      context "when no list of subvolumes is specified in the configuration" do
        let(:btrfs_hash) { { "snapshots" => false } }

        it "sets the subvolumes to an empty list" do
          vol = builder.for("/")
          expect(vol.btrfs.subvolumes).to eq []
        end
      end

      context "when the list of subvolumes mixes strings and hashes" do
        let(:subvolumes) do
          [
            "root",
            "home",
            { "path" => "boot", "archs" => "x86_64, !ppc" },
            { "path" => "var", "copy_on_write" => false },
            "srv"
          ]
        end

        it "creates the correct list of subvolumes" do
          subvols = builder.for("/").btrfs.subvolumes

          expect(subvols).to all be_a(Y2Storage::SubvolSpecification)

          expect(subvols).to contain_exactly(
            an_object_having_attributes(
              path:          "root",
              archs:         nil,
              copy_on_write: true
            ),
            an_object_having_attributes(
              path:          "home",
              archs:         nil,
              copy_on_write: true
            ),
            an_object_having_attributes(
              path:          "boot",
              archs:         ["x86_64", "!ppc"],
              copy_on_write: true
            ),
            an_object_having_attributes(
              path:          "var",
              archs:         nil,
              copy_on_write: false
            ),
            an_object_having_attributes(
              path:          "srv",
              archs:         nil,
              copy_on_write: true
            )
          )
        end
      end
    end
  end
end
