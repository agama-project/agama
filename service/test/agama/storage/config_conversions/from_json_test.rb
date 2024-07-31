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
require "agama/storage/config_conversions/from_json"
require "agama/config"
require "y2storage/encryption_method"
require "y2storage/pbkd_function"

describe Agama::Storage::ConfigConversions::FromJSON do
  subject { described_class.new(config_json, product_config: product_config) }

  let(:product_config) { Agama::Config.new(product_data) }

  let(:product_data) do
    {
      "storage" => {
        "lvm"              => false,
        "space_policy"     => "delete",
        "encryption"       => {
          "method"        => "luks2",
          "pbkd_function" => "argon2id"
        },
        "volumes"          => ["/", "swap"],
        "volume_templates" => [
          {
            "mount_path" => "/", "filesystem" => "btrfs", "size" => { "auto" => true },
            "btrfs" => {
              "snapshots" => true, "default_subvolume" => "@",
              "subvolumes" => ["home", "opt", "root", "srv"]
            },
            "outline" => {
              "required" => true, "snapshots_configurable" => true,
              "auto_size" => {
                "base_min" => "5 GiB", "base_max" => "10 GiB",
                "min_fallback_for" => ["/home"], "max_fallback_for" => ["/home"],
                "snapshots_increment" => "300%"
              }
            }
          },
          {
            "mount_path" => "/home", "size" => { "auto" => false, "min" => "5 GiB" },
            "outline"    => { "required" => false, "filesystem" => "xfs" }
          },
          {
            "mount_path" => "swap",
            "outline"    => { "required" => false, "filesystem" => "swap" }
          },
          { "mount_path" => "", "size" => { "min" => "100 MiB" } }
        ]
      }
    }
  end

  describe "#convert" do
    using Y2Storage::Refinements::SizeCasts

    # TODO:
    # Encryption
    # Filesystem type (btrfs, etc)
    # Filesystem at disk (including default types based on config, etc.)
    # Filesystem at partition
    # Partition id

    context "with an empty JSON configuration" do
      let(:config_json) { {} }

      it "generates a storage configuration" do
        config = subject.convert
        expect(config).to be_a(Agama::Storage::Config)
      end

      it "calculates default boot settings" do
        config = subject.convert
        expect(config.boot).to be_a(Agama::Storage::Configs::Boot)
        expect(config.boot.configure).to eq true
        expect(config.boot.device).to eq nil
      end

      # FIXME: Is this correct?
      it "does not include any device in the configuration" do
        config = subject.convert
        expect(config.drives).to be_empty
      end
    end

    context "with some drives and boot configuration at JSON" do
      let(:config_json) do
        {
          boot: { configure: true, device: "/dev/sdb" },
          drives: [
            {
              ptableType: "gpt",
              partitions: [{ filesystem: { path: "/" } }]
            }
          ]
        }
      end

      it "generates a storage configuration" do
        config = subject.convert
        expect(config).to be_a(Agama::Storage::Config)
      end

      it "calculates the corresponding boot settings" do
        config = subject.convert
        expect(config.boot).to be_a(Agama::Storage::Configs::Boot)
        expect(config.boot.configure).to eq true
        expect(config.boot.device).to eq "/dev/sdb"
      end

      it "includes the corresponding drives" do
        config = subject.convert
        expect(config.drives.size).to eq 1
        drive = config.drives.first
        expect(drive).to be_a(Agama::Storage::Configs::Drive)
        expect(drive.ptable_type).to eq Y2Storage::PartitionTables::Type::GPT
        expect(drive.partitions.size).to eq 1
        partition = drive.partitions.first
        expect(partition.filesystem.path).to eq "/"
      end
    end

    context "omitting sizes for the partitions" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                {
                  filesystem: { path: "/", type: { btrfs: { snapshots: false } } }
                },
                {
                  filesystem: { path: "/home" }
                },
                {
                  filesystem: { path: "/opt" }
                },
                {
                  filesystem: { path: "swap" }
                }
              ]
            }
          ]
        }
      end

      it "uses default sizes" do
        config = subject.convert
        partitions = config.drives.first.partitions
        expect(partitions).to contain_exactly(
          an_object_having_attributes(
            filesystem: have_attributes(path: "/"),
            size: have_attributes(default: true, min: 5.GiB, max: 10.GiB)
          ),
          an_object_having_attributes(
            filesystem: have_attributes(path: "/home"),
            size: have_attributes(default: true, min: 5.GiB, max: Y2Storage::DiskSize.unlimited)
          ),
          an_object_having_attributes(
            filesystem: have_attributes(path: "/opt"),
            size: have_attributes(default: true, min: 100.MiB, max: Y2Storage::DiskSize.unlimited)
          ),
          an_object_having_attributes(
            filesystem: have_attributes(path: "swap"),
            size: have_attributes(
              default: true, min: Y2Storage::DiskSize.zero, max: Y2Storage::DiskSize.unlimited
            )
          )
        )
      end
    end

    # Note the min is mandatory
    context "specifying size limits for the partitions" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                {
                  filesystem: { path: "/", type: { btrfs: { snapshots: false } } },
                  size: { min: "3 GiB" }
                },
                {
                  filesystem: { path: "/home" },
                  size: { min: "6 GiB", max: "9 GiB" }
                }
              ]
            }
          ]
        }
      end

      it "sets both min and max limits as requested" do
        config = subject.convert
        partitions = config.drives.first.partitions
        expect(partitions).to include(
          an_object_having_attributes(
            filesystem: have_attributes(path: "/home"),
            size: have_attributes(default: false, min: 6.GiB, max: 9.GiB)
          )
        )
      end

      it "uses unlimited for the omitted max sizes" do
        config = subject.convert
        partitions = config.drives.first.partitions
        expect(partitions).to include(
          an_object_having_attributes(
            filesystem: have_attributes(path: "/"),
            size: have_attributes(default: false, min: 3.GiB, max: Y2Storage::DiskSize.unlimited)
          )
        )
      end
    end

    context "specifying a filesystem for a drive" do
      let(:config_json) do
        {
          drives: [{ filesystem: filesystem }]
        }
      end

      context "if the filesystem specification only contains a path" do
        let(:filesystem) { { path: "/" } }

        it "uses the default type and btrfs attributes for that path" do
          config = subject.convert
          filesystem = config.drives.first.filesystem
          expect(filesystem.type.fstype).to eq Y2Storage::Filesystems::Type::BTRFS
          expect(filesystem.type.btrfs.snapshots).to eq true
          expect(filesystem.type.btrfs.default_subvolume).to eq "@"
          expect(filesystem.type.btrfs.subvolumes.map(&:path)).to eq ["home", "opt", "root", "srv"]
        end
      end
    end
  end
end
