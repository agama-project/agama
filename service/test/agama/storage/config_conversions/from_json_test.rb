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
require "agama/config"
require "agama/storage/config_conversions/from_json"
require "y2storage/encryption_method"
require "y2storage/filesystems/mount_by_type"
require "y2storage/filesystems/type"
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
            "filesystem" => "xfs", "outline" => { "required" => false }
          },
          {
            "mount_path" => "swap", "filesystem" => "swap",
            "outline"    => { "required" => false }
          },
          { "mount_path" => "", "filesystem" => "ext4",
            "size" => { "min" => "100 MiB" } }
        ]
      }
    }
  end

  before do
    # Speed up tests by avoding real check of TPM presence.
    allow(Y2Storage::EncryptionMethod::TPM_FDE).to receive(:possible?).and_return(true)
  end

  describe "#convert" do
    using Y2Storage::Refinements::SizeCasts

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

      # @todo Generate default drive/LVM from product descripton.
      it "does not include any device in the configuration" do
        config = subject.convert
        expect(config.drives).to be_empty
      end
    end

    context "with some drives and boot configuration at JSON" do
      let(:config_json) do
        {
          boot:   { configure: true, device: "/dev/sdb" },
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
                { filesystem: { path: "/", type: { btrfs: { snapshots: false } } } },
                { filesystem: { path: "/home" } },
                { filesystem: { path: "/opt" } },
                { filesystem: { path: "swap" } }
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
            size:       have_attributes(default: true, min: 5.GiB, max: 10.GiB)
          ),
          an_object_having_attributes(
            filesystem: have_attributes(path: "/home"),
            size:       have_attributes(default: true, min: 5.GiB,
              max: Y2Storage::DiskSize.unlimited)
          ),
          an_object_having_attributes(
            filesystem: have_attributes(path: "/opt"),
            size:       have_attributes(default: true, min: 100.MiB,
              max: Y2Storage::DiskSize.unlimited)
          ),
          an_object_having_attributes(
            filesystem: have_attributes(path: "swap"),
            size:       have_attributes(
              default: true, min: Y2Storage::DiskSize.zero, max: Y2Storage::DiskSize.unlimited
            )
          )
        )
      end
    end

    context "setting fixed sizes for the partitions" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                { filesystem: { path: "/" }, size: "10 GiB" },
                { filesystem: { path: "/home" }, size: "6Gb" },
                { filesystem: { path: "/opt" }, size: 3221225472 },
                { filesystem: { path: "swap" }, size: "6 Gib" }
              ]
            }
          ]
        }
      end

      it "sets both min and max to the same value if a string is used" do
        config = subject.convert
        partitions = config.drives.first.partitions
        expect(partitions).to include(
          an_object_having_attributes(
            filesystem: have_attributes(path: "/"),
            size:       have_attributes(default: false, min: 10.GiB, max: 10.GiB)
          )
        )
      end

      it "sets both min and max to the same value if an integer is used" do
        config = subject.convert
        partitions = config.drives.first.partitions
        expect(partitions).to include(
          an_object_having_attributes(
            filesystem: have_attributes(path: "/opt"),
            size:       have_attributes(default: false, min: 3.GiB, max: 3.GiB)
          )
        )
      end

      it "makes a difference between SI units and binary units" do
        config = subject.convert
        partitions = config.drives.first.partitions
        home_size = partitions.find { |p| p.filesystem.path == "/home" }.size
        swap_size = partitions.find { |p| p.filesystem.path == "swap" }.size
        expect(swap_size.min.to_i).to eq 6 * 1024 * 1024 * 1024
        expect(home_size.max.to_i).to eq 6 * 1000 * 1000 * 1000
      end
    end

    # Note the min is mandatory
    context "specifying size limits for the partitions" do
      RSpec.shared_examples "size limits" do
        it "sets both min and max limits as requested if strings are used" do
          config = subject.convert
          partitions = config.drives.first.partitions
          expect(partitions).to include(
            an_object_having_attributes(
              filesystem: have_attributes(path: "/home"),
              size:       have_attributes(default: false, min: 6.GiB, max: 9.GiB)
            )
          )
        end

        it "makes a difference between SI units and binary units" do
          config = subject.convert
          partitions = config.drives.first.partitions
          home_size = partitions.find { |p| p.filesystem.path == "/home" }.size
          swap_size = partitions.find { |p| p.filesystem.path == "swap" }.size
          expect(home_size.min.to_i).to eq 6 * 1024 * 1024 * 1024
          expect(swap_size.max.to_i).to eq 6 * 1000 * 1000 * 1000
        end

        it "sets both min and max limits as requested if numbers are used" do
          config = subject.convert
          partitions = config.drives.first.partitions
          expect(partitions).to include(
            an_object_having_attributes(
              filesystem: have_attributes(path: "swap"),
              size:       have_attributes(default: false, min: 1.GiB)
            ),
            an_object_having_attributes(
              filesystem: have_attributes(path: "/opt"),
              size:       have_attributes(default: false, min: 1.GiB, max: 3.GiB)
            )
          )
        end

        it "uses unlimited for the omitted max sizes" do
          config = subject.convert
          partitions = config.drives.first.partitions
          expect(partitions).to include(
            an_object_having_attributes(
              filesystem: have_attributes(path: "/"),
              size:       have_attributes(default: false, min: 3.GiB,
                max: Y2Storage::DiskSize.unlimited)
            )
          )
        end
      end

      context "using a hash" do
        let(:config_json) do
          {
            drives: [
              {
                partitions: [
                  {
                    filesystem: { path: "/", type: { btrfs: { snapshots: false } } },
                    size:       { min: "3 GiB" }
                  },
                  {
                    filesystem: { path: "/home" },
                    size:       { min: "6 GiB", max: "9 GiB" }
                  },
                  {
                    filesystem: { path: "swap" },
                    size:       { min: 1073741824, max: "6 GB" }
                  },
                  {
                    filesystem: { path: "/opt" },
                    size:       { min: "1073741824", max: 3221225472 }
                  }
                ]
              }
            ]
          }
        end

        include_examples "size limits"
      end

      context "using an array" do
        let(:config_json) do
          {
            drives: [
              {
                partitions: [
                  {
                    filesystem: { path: "/", type: { btrfs: { snapshots: false } } },
                    size:       ["3 GiB"]
                  },
                  {
                    filesystem: { path: "/home" },
                    size:       ["6 GiB", "9 GiB"]
                  },
                  {
                    filesystem: { path: "swap" },
                    size:       [1073741824, "6 GB"]
                  },
                  {
                    filesystem: { path: "/opt" },
                    size:       ["1073741824", 3221225472]
                  }
                ]
              }
            ]
          }
        end

        include_examples "size limits"
      end
    end

    context "using 'default' as size for some partitions and size limit for others" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                {
                  filesystem: { path: "/", size: "default" }
                },
                {
                  filesystem: { path: "/opt" },
                  size:       { min: "6 GiB", max: "22 GiB" }
                }
              ]
            }
          ]
        }
      end

      it "uses the appropriate sizes for each partition" do
        config = subject.convert
        partitions = config.drives.first.partitions
        expect(partitions).to contain_exactly(
          an_object_having_attributes(
            filesystem: have_attributes(path: "/"),
            size:       have_attributes(default: true, min: 40.GiB,
              max: Y2Storage::DiskSize.unlimited)
          ),
          an_object_having_attributes(
            filesystem: have_attributes(path: "/opt"),
            size:       have_attributes(default: false, min: 6.GiB, max: 22.GiB)
          )
        )
      end
    end

    context "using 'default' as size for some partitions and size limit for others" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                {
                  filesystem: { path: "/", size: "default" }
                },
                {
                  filesystem: { path: "/opt" },
                  size:       { min: "6 GiB", max: "22 GiB" }
                }
              ]
            }
          ]
        }
      end

      it "uses the appropriate sizes for each partition" do
        config = subject.convert
        partitions = config.drives.first.partitions
        expect(partitions).to contain_exactly(
          an_object_having_attributes(
            filesystem: have_attributes(path: "/"),
            size:       have_attributes(default: true, min: 40.GiB,
              max: Y2Storage::DiskSize.unlimited)
          ),
          an_object_having_attributes(
            filesystem: have_attributes(path: "/opt"),
            size:       have_attributes(default: false, min: 6.GiB, max: 22.GiB)
          )
        )
      end
    end

    context "using 'default' for a partition that is fallback for others" do
      let(:config_json) { { drives: [{ partitions: partitions }] } }
      let(:root) do
        { filesystem: { path: "/", type: { btrfs: { snapshots: false } } }, size: "default" }
      end
      let(:partitions) { [root] + other }

      context "if the other partitions are ommitted" do
        let(:other) { [] }

        it "sums all the fallback sizes" do
          config = subject.convert
          partitions = config.drives.first.partitions
          expect(partitions).to contain_exactly(
            an_object_having_attributes(
              filesystem: have_attributes(path: "/"),
              size:       have_attributes(default: true, min: 10.GiB,
                max: Y2Storage::DiskSize.unlimited)
            )
          )
        end
      end

      context "if the other partitions are included (even with non-exact name)" do
        let(:other) { [{ filesystem: { path: "/home/" } }] }

        it "ignores the fallback sizes" do
          config = subject.convert
          partitions = config.drives.first.partitions
          expect(partitions).to include(
            an_object_having_attributes(
              filesystem: have_attributes(path: "/"),
              size:       have_attributes(default: true, min: 5.GiB, max: 10.GiB)
            )
          )
        end
      end
    end

    context "specifying a filesystem for a drive" do
      let(:config_json) do
        {
          drives: [{ filesystem: filesystem }]
        }
      end

      let(:filesystem) do
        {
          path:         "/",
          type:         "xfs",
          label:        "root",
          mkfsOptions:  ["version=2"],
          mountOptions: ["rw"],
          mountBy:      "label"
        }
      end

      it "uses the specified attributes" do
        config = subject.convert
        filesystem = config.drives.first.filesystem
        expect(filesystem.path).to eq "/"
        expect(filesystem.type.fs_type).to eq Y2Storage::Filesystems::Type::XFS
        expect(filesystem.label).to eq "root"
        expect(filesystem.mkfs_options).to eq ["version=2"]
        expect(filesystem.mount_options).to eq ["rw"]
        expect(filesystem.mount_by).to eq Y2Storage::Filesystems::MountByType::LABEL
      end

      context "if the filesystem specification only contains a path" do
        let(:filesystem) { { path: "/" } }

        it "uses the default type and btrfs attributes for that path" do
          config = subject.convert
          filesystem = config.drives.first.filesystem
          expect(filesystem.type.fs_type).to eq Y2Storage::Filesystems::Type::BTRFS
          expect(filesystem.type.btrfs.snapshots).to eq true
          expect(filesystem.type.btrfs.default_subvolume).to eq "@"
          expect(filesystem.type.btrfs.subvolumes.map(&:path)).to eq ["home", "opt", "root", "srv"]
        end
      end

      context "if the filesystem specification contains some btrfs settings" do
        let(:filesystem) do
          { path: "/",
            type: { btrfs: { snapshots: false, default_subvolume: "", subvolumes: ["tmp"] } } }
        end

        it "uses the specified btrfs attributes" do
          config = subject.convert
          filesystem = config.drives.first.filesystem
          expect(filesystem.type.fs_type).to eq Y2Storage::Filesystems::Type::BTRFS
          expect(filesystem.type.btrfs.snapshots).to eq false
          # TODO: none of the following attributes are specified at the schema. Intentional?
          # expect(filesystem.type.btrfs.default_subvolume).to eq ""
          # expect(filesystem.type.btrfs.subvolumes.map(&:path)).to eq ["tmp"]
        end

        context "and the default filesystem type is not btrfs" do
          let(:filesystem) do
            { path: "/home", type: { btrfs: { snapshots: false } } }
          end

          it "uses btrfs filesystem" do
            config = subject.convert
            filesystem = config.drives.first.filesystem
            expect(filesystem.type.fs_type).to eq Y2Storage::Filesystems::Type::BTRFS
          end
        end
      end
    end

    context "configuring partial information for several mount points" do
      let(:config_json) { { drives: [{ partitions: partitions }] } }
      let(:partitions) do
        [
          { filesystem: { path: "/" } },
          { filesystem: { path: "swap" } },
          { filesystem: { path: "/opt" } }
        ]
      end

      it "configures the filesystem types according to the product configuration" do
        config = subject.convert
        partitions = config.drives.first.partitions
        expect(partitions).to contain_exactly(
          an_object_having_attributes(
            filesystem: have_attributes(
              path: "/", type: have_attributes(fs_type: Y2Storage::Filesystems::Type::BTRFS)
            )
          ),
          an_object_having_attributes(
            filesystem: have_attributes(
              path: "swap", type: have_attributes(fs_type: Y2Storage::Filesystems::Type::SWAP)
            )
          ),
          an_object_having_attributes(
            filesystem: have_attributes(
              path: "/opt", type: have_attributes(fs_type: Y2Storage::Filesystems::Type::EXT4)
            )
          )
        )
      end
    end

    context "when some partition is configured to be encrypted" do
      let(:config_json) do
        {
          drives: [{ partitions: partitions }]
        }
      end

      let(:partitions) do
        [
          {
            id: "linux", size: { min: "10 GiB" },
            filesystem: { type: "xfs", path: "/home" },
            encryption: encryption_home
          },
          {
            size:       { min: "2 GiB" },
            filesystem: { type: "swap", path: "swap" },
            encryption: encryption_swap
          }
        ]
      end

      let(:encryption_home) do
        { luks2: { password: "notsecret", keySize: 256 } }
      end

      let(:encryption_swap) { nil }

      it "sets the encryption settings for the corresponding partition" do
        config = subject.convert
        partitions = config.drives.first.partitions
        expect(partitions).to contain_exactly(
          an_object_having_attributes(
            filesystem: have_attributes(path: "/home"),
            encryption: have_attributes(
              password: "notsecret", method: Y2Storage::EncryptionMethod::LUKS2, key_size: 256
            )
          ),
          an_object_having_attributes(
            filesystem: have_attributes(path: "swap"),
            encryption: nil
          )
        )
      end

      context "if only the password is provided" do
        let(:encryption_home) { { luks2: { password: "notsecret" } } }
        let(:encryption_swap) { nil }

        it "uses the default derivation function" do
          config = subject.convert
          partitions = config.drives.first.partitions
          expect(partitions).to contain_exactly(
            an_object_having_attributes(
              filesystem: have_attributes(path: "/home"),
              encryption: have_attributes(
                password:      "notsecret",
                method:        Y2Storage::EncryptionMethod::LUKS2,
                pbkd_function: Y2Storage::PbkdFunction::ARGON2ID
              )
            ),
            an_object_having_attributes(
              filesystem: have_attributes(path: "swap"),
              encryption: nil
            )
          )
        end
      end

      context "if random encryption is configured for swap" do
        let(:encryption_home) { nil }
        let(:encryption_swap) { "random_swap" }

        it "sets the corresponding configuration" do
          config = subject.convert
          partitions = config.drives.first.partitions
          expect(partitions).to contain_exactly(
            an_object_having_attributes(
              filesystem: have_attributes(path: "/home"),
              encryption: nil
            ),
            an_object_having_attributes(
              filesystem: have_attributes(path: "swap"),
              encryption: have_attributes(
                password: nil,
                label:    nil,
                cipher:   nil,
                method:   Y2Storage::EncryptionMethod::RANDOM_SWAP
              )
            )
          )
        end
      end
    end

    context "when the id of some partition is specified" do
      let(:config_json) do
        {
          drives: [{ partitions: partitions }]
        }
      end

      let(:partitions) do
        [
          {
            id: "Esp", size: { min: "10 GiB" },
            filesystem: { type: "xfs", path: "/home" }
          },
          {
            size:       { min: "2 GiB" },
            filesystem: { type: "swap", path: "swap" }
          }
        ]
      end

      it "configures the corresponding id" do
        config = subject.convert
        partitions = config.drives.first.partitions
        expect(partitions).to contain_exactly(
          an_object_having_attributes(
            filesystem: have_attributes(path: "/home"),
            id:         Y2Storage::PartitionId::ESP
          ),
          an_object_having_attributes(
            filesystem: have_attributes(path: "swap"),
            id:         nil
          )
        )
      end
    end
  end
end
