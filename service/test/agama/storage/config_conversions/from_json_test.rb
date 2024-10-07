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
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

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

  shared_examples "omitting sizes" do |result|
    let(:example_configs) do
      [
        { filesystem: { path: "/", type: { btrfs: { snapshots: false } } } },
        { filesystem: { path: "/home" } },
        { filesystem: { path: "/opt" } },
        { filesystem: { path: "swap" } }
      ]
    end

    it "uses default sizes" do
      config = subject.convert
      devices = result.call(config)
      expect(devices).to contain_exactly(
        an_object_having_attributes(
          filesystem: have_attributes(path: "/"),
          size:       have_attributes(default: true, min: be_nil, max: be_nil)
        ),
        an_object_having_attributes(
          filesystem: have_attributes(path: "/home"),
          size:       have_attributes(default: true, min: be_nil, max: be_nil)
        ),
        an_object_having_attributes(
          filesystem: have_attributes(path: "/opt"),
          size:       have_attributes(default: true, min: be_nil, max: be_nil)
        ),
        an_object_having_attributes(
          filesystem: have_attributes(path: "swap"),
          size:       have_attributes(default: true, min: be_nil, max: be_nil)
        )
      )
    end
  end

  shared_examples "fixed sizes" do |result|
    let(:example_configs) do
      [
        { filesystem: { path: "/" }, size: "10 GiB" },
        { filesystem: { path: "/home" }, size: "6Gb" },
        { filesystem: { path: "/opt" }, size: 3221225472 },
        { filesystem: { path: "swap" }, size: "6 Gib" }
      ]
    end

    it "sets both min and max to the same value if a string is used" do
      config = subject.convert
      devices = result.call(config)
      expect(devices).to include(
        an_object_having_attributes(
          filesystem: have_attributes(path: "/"),
          size:       have_attributes(default: false, min: 10.GiB, max: 10.GiB)
        )
      )
    end

    it "sets both min and max to the same value if an integer is used" do
      config = subject.convert
      devices = result.call(config)
      expect(devices).to include(
        an_object_having_attributes(
          filesystem: have_attributes(path: "/opt"),
          size:       have_attributes(default: false, min: 3.GiB, max: 3.GiB)
        )
      )
    end

    it "makes a difference between SI units and binary units" do
      config = subject.convert
      devices = result.call(config)
      home_size = devices.find { |d| d.filesystem.path == "/home" }.size
      swap_size = devices.find { |d| d.filesystem.path == "swap" }.size
      expect(swap_size.min.to_i).to eq 6 * 1024 * 1024 * 1024
      expect(home_size.max.to_i).to eq 6 * 1000 * 1000 * 1000
    end
  end

  shared_examples "size limits" do |result|
    shared_examples "limit tests" do
      it "sets both min and max limits as requested if strings are used" do
        config = subject.convert
        devices = result.call(config)
        expect(devices).to include(
          an_object_having_attributes(
            filesystem: have_attributes(path: "/home"),
            size:       have_attributes(default: false, min: 6.GiB, max: 9.GiB)
          )
        )
      end

      it "makes a difference between SI units and binary units" do
        config = subject.convert
        devices = result.call(config)
        home_size = devices.find { |d| d.filesystem.path == "/home" }.size
        swap_size = devices.find { |d| d.filesystem.path == "swap" }.size
        expect(home_size.min.to_i).to eq 6 * 1024 * 1024 * 1024
        expect(swap_size.max.to_i).to eq 6 * 1000 * 1000 * 1000
      end

      it "sets both min and max limits as requested if numbers are used" do
        config = subject.convert
        devices = result.call(config)
        expect(devices).to include(
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
        devices = result.call(config)
        expect(devices).to include(
          an_object_having_attributes(
            filesystem: have_attributes(path: "/"),
            size:       have_attributes(default: false, min: 3.GiB,
              max: Y2Storage::DiskSize.unlimited)
          )
        )
      end

      it "uses nil for min size as current" do
        config = subject.convert
        devices = result.call(config)
        expect(devices).to include(
          an_object_having_attributes(
            filesystem: have_attributes(path: "/data1"),
            size:       have_attributes(default: false, min: be_nil,
              max: Y2Storage::DiskSize.unlimited)
          )
        )
      end

      it "uses nil for max size as current" do
        config = subject.convert
        devices = result.call(config)
        expect(devices).to include(
          an_object_having_attributes(
            filesystem: have_attributes(path: "/data2"),
            size:       have_attributes(default: false, min: 10.GiB, max: be_nil)
          )
        )
      end
    end

    context "using a hash" do
      let(:example_configs) do
        [
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
          },
          {
            filesystem: { path: "/data1" },
            size:       { min: "current" }
          },
          {
            filesystem: { path: "/data2" },
            size:       { min: "10 GiB", max: "current" }
          }
        ]
      end

      include_examples "limit tests"
    end

    context "using an array" do
      let(:example_configs) do
        [
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
          },
          {
            filesystem: { path: "/data1" },
            size:       ["current"]
          },
          {
            filesystem: { path: "/data2" },
            size:       ["10 GiB", "current"]
          }
        ]
      end

      include_examples "limit tests"
    end
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
              alias:      "first-disk",
              ptableType: "gpt",
              partitions: [
                {
                  alias:      "root",
                  filesystem: { path: "/" }
                }
              ]
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
        expect(drive.alias).to eq "first-disk"
        expect(drive.ptable_type).to eq Y2Storage::PartitionTables::Type::GPT
        expect(drive.partitions.size).to eq 1
        partition = drive.partitions.first
        expect(partition.alias).to eq "root"
        expect(partition.filesystem.path).to eq "/"
      end

      context "omitting search for a drive" do
        let(:config_json) do
          {
            drives: [
              {
                partitions: []
              }
            ]
          }
        end

        it "sets the default search" do
          config = subject.convert
          drive = config.drives.first
          expect(drive.search).to be_a(Agama::Storage::Configs::Search)
          expect(drive.search.name).to be_nil
          expect(drive.search.if_not_found).to eq(:error)
        end
      end

      context "specifying search for a drive" do
        let(:config_json) do
          {
            drives: [
              {
                search:     search,
                partitions: []
              }
            ]
          }
        end

        context "with a device name" do
          let(:search) { "/dev/vda" }

          it "sets the expected search" do
            config = subject.convert
            drive = config.drives.first
            expect(drive.search).to be_a(Agama::Storage::Configs::Search)
            expect(drive.search.name).to eq("/dev/vda")
            expect(drive.search.if_not_found).to eq(:error)
          end
        end

        context "with a search section" do
          let(:search) do
            {
              condition:  { name: "/dev/vda" },
              ifNotFound: "skip"
            }
          end

          it "sets the expected search" do
            config = subject.convert
            drive = config.drives.first
            expect(drive.search).to be_a(Agama::Storage::Configs::Search)
            expect(drive.search.name).to eq("/dev/vda")
            expect(drive.search.if_not_found).to eq(:skip)
          end
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
          reuseIfPossible: true,
          path:            "/",
          type:            "xfs",
          label:           "root",
          mkfsOptions:     ["version=2"],
          mountOptions:    ["rw"],
          mountBy:         "label"
        }
      end

      it "uses the specified attributes" do
        config = subject.convert
        filesystem = config.drives.first.filesystem
        expect(filesystem.reuse?).to eq true
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
          expect(filesystem.reuse?).to eq false
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

    context "omitting search for a partition" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                {
                  filesystem: {
                    path: "/"
                  }
                }
              ]
            }
          ]
        }
      end

      it "does not set a search" do
        config = subject.convert
        drive = config.drives.first
        partition = drive.partitions.first
        expect(partition.search).to be_nil
      end
    end

    context "specifying search for a partition" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                {
                  search:     search,
                  filesystem: {
                    path: "/"
                  }
                }
              ]
            }
          ]
        }
      end

      context "with a device name" do
        let(:search) { "/dev/vda1" }

        it "sets the expected search" do
          config = subject.convert
          drive = config.drives.first
          partition = drive.partitions.first
          expect(partition.search).to be_a(Agama::Storage::Configs::Search)
          expect(partition.search.name).to eq("/dev/vda1")
          expect(partition.search.if_not_found).to eq(:error)
        end
      end

      context "with a search section" do
        let(:search) do
          {
            condition:  { name: "/dev/vda1" },
            ifNotFound: "skip"
          }
        end

        it "sets the expected search" do
          config = subject.convert
          drive = config.drives.first
          partition = drive.partitions.first
          expect(partition.search).to be_a(Agama::Storage::Configs::Search)
          expect(partition.search.name).to eq("/dev/vda1")
          expect(partition.search.if_not_found).to eq(:skip)
        end
      end
    end

    context "setting delete for a partition" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                {
                  search: "/dev/vda1",
                  delete: true
                },
                {
                  filesystem: { path: "/" }
                }
              ]
            }
          ]
        }
      end

      it "sets #delete to true" do
        config = subject.convert
        partitions = config.drives.first.partitions
        expect(partitions).to contain_exactly(
          an_object_having_attributes(
            search:           have_attributes(name: "/dev/vda1"),
            delete:           true,
            delete_if_needed: false
          ),
          an_object_having_attributes(
            filesystem:       have_attributes(path: "/"),
            delete:           false,
            delete_if_needed: false
          )
        )
      end
    end

    context "setting delete if needed for a partition" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                {
                  search:         "/dev/vda1",
                  deleteIfNeeded: true
                },
                {
                  filesystem: { path: "/" }
                }
              ]
            }
          ]
        }
      end

      it "sets #delete_if_needed to true" do
        config = subject.convert
        partitions = config.drives.first.partitions
        expect(partitions).to contain_exactly(
          an_object_having_attributes(
            search:           have_attributes(name: "/dev/vda1"),
            delete:           false,
            delete_if_needed: true
          ),
          an_object_having_attributes(
            filesystem:       have_attributes(path: "/"),
            delete:           false,
            delete_if_needed: false
          )
        )
      end
    end

    context "omitting sizes for the partitions" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: example_configs
            }
          ]
        }
      end

      result = proc { |config| config.drives.first.partitions }

      include_examples "omitting sizes", result
    end

    context "setting fixed sizes for the partitions" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: example_configs
            }
          ]
        }
      end

      result = proc { |config| config.drives.first.partitions }

      include_examples "fixed sizes", result
    end

    context "specifying size limits for the partitions" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: example_configs
            }
          ]
        }
      end

      result = proc { |config| config.drives.first.partitions }

      include_examples "size limits", result
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

    context "with some LVM volume groups" do
      let(:config_json) do
        {
          volumeGroups: [
            {
              name:            "vg0",
              extentSize:      "2 MiB",
              physicalVolumes: ["alias1", "alias2"],
              logicalVolumes:  [
                {
                  name:       "root",
                  filesystem: { path: "/" },
                  encryption: {
                    luks2: { password: "12345" }
                  }
                },
                {
                  alias:      "thin-pool",
                  name:       "pool",
                  pool:       true,
                  size:       "100 GiB",
                  stripes:    10,
                  stripeSize: "4 KiB"
                },
                {
                  name:       "data",
                  size:       "50 GiB",
                  usedPool:   "thin-pool",
                  filesystem: { type: "xfs" }
                }
              ]
            },
            {
              name: "vg1"
            }
          ]
        }
      end

      it "generates the corresponding volume groups and logical volumes" do
        config = subject.convert

        expect(config.volume_groups).to contain_exactly(
          an_object_having_attributes(
            name:             "vg0",
            extent_size:      2.MiB,
            physical_volumes: ["alias1", "alias2"]
          ),
          an_object_having_attributes(
            name:             "vg1",
            extent_size:      be_nil,
            physical_volumes: be_empty,
            logical_volumes:  be_empty
          )
        )

        logical_volumes = config.volume_groups
          .find { |v| v.name == "vg0" }
          .logical_volumes

        expect(logical_volumes).to include(
          an_object_having_attributes(
            alias:       be_nil,
            name:        "root",
            encryption:  have_attributes(
              password:      "12345",
              method:        Y2Storage::EncryptionMethod::LUKS2,
              pbkd_function: Y2Storage::PbkdFunction::ARGON2ID
            ),
            filesystem:  have_attributes(
              path: "/",
              type: have_attributes(
                fs_type: Y2Storage::Filesystems::Type::BTRFS
              )
            ),
            size:        have_attributes(
              default: true,
              min:     be_nil,
              max:     be_nil
            ),
            stripes:     be_nil,
            stripe_size: be_nil,
            pool:        false,
            used_pool:   be_nil
          ),
          an_object_having_attributes(
            alias:       "thin-pool",
            name:        "pool",
            encryption:  be_nil,
            filesystem:  be_nil,
            size:        have_attributes(
              default: false,
              min:     100.GiB,
              max:     100.GiB
            ),
            stripes:     10,
            stripe_size: 4.KiB,
            pool:        true,
            used_pool:   be_nil
          ),
          an_object_having_attributes(
            alias:       be_nil,
            name:        "data",
            encryption:  be_nil,
            filesystem:  have_attributes(
              path: be_nil,
              type: have_attributes(
                fs_type: Y2Storage::Filesystems::Type::XFS
              )
            ),
            size:        have_attributes(
              default: false,
              min:     50.GiB,
              max:     50.GiB
            ),
            stripes:     be_nil,
            stripe_size: be_nil,
            pool:        false,
            used_pool:   "thin-pool"
          )
        )
      end
    end

    context "omitting sizes for the logical volumes" do
      let(:config_json) do
        {
          volumeGroups: [
            {
              logicalVolumes: example_configs
            }
          ]
        }
      end

      result = proc { |config| config.volume_groups.first.logical_volumes }

      include_examples "omitting sizes", result
    end

    context "setting fixed sizes for the logical volumes" do
      let(:config_json) do
        {
          volumeGroups: [
            {
              logicalVolumes: example_configs
            }
          ]
        }
      end

      result = proc { |config| config.volume_groups.first.logical_volumes }

      include_examples "fixed sizes", result
    end

    context "specifying size limits for the logical volumes" do
      let(:config_json) do
        {
          volumeGroups: [
            {
              logicalVolumes: example_configs
            }
          ]
        }
      end

      result = proc { |config| config.volume_groups.first.logical_volumes }

      include_examples "size limits", result
    end

    context "using 'generate' with 'default' for partitions in a drive" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                { generate: "default" }
              ]
            }
          ]
        }
      end

      it "includes the default partitions defined by the product" do
        config = subject.convert
        partitions = config.drives.first.partitions

        expect(partitions.size).to eq(2)

        root = partitions.find { |p| p.filesystem.path == "/" }
        expect(root.filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
        expect(root.size.default?).to eq(true)

        swap = partitions.find { |p| p.filesystem.path == "swap" }
        expect(swap.filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::SWAP)
        expect(swap.size.default?).to eq(true)
      end

      context "if the drive already defines some of the default paths" do
        let(:config_json) do
          {
            drives: [
              {
                partitions: [
                  { generate: "default" },
                  {
                    filesystem: { path: "swap" },
                    size:       "2 GiB"
                  }
                ]
              }
            ]
          }
        end

        it "only includes the missing default partitions" do
          config = subject.convert
          partitions = config.drives.first.partitions

          expect(partitions.size).to eq(2)

          root = partitions.find { |p| p.filesystem.path == "/" }
          expect(root.filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
          expect(root.size.default?).to eq(true)

          swap = partitions.find { |p| p.filesystem.path == "swap" }
          expect(swap.filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::SWAP)
          expect(swap.size.default?).to eq(false)
          expect(swap.size.min).to eq(2.GiB)
          expect(swap.size.max).to eq(2.GiB)
        end
      end

      context "if there are more than one 'generate'" do
        let(:config_json) do
          {
            drives: [
              {
                partitions: [
                  { generate: "default" },
                  { generate: "default" }
                ]
              }
            ]
          }
        end

        it "does not include the same partition twice" do
          config = subject.convert
          partitions = config.drives.first.partitions

          expect(partitions.size).to eq(2)

          root = partitions.find { |p| p.filesystem.path == "/" }
          expect(root).to_not be_nil

          swap = partitions.find { |p| p.filesystem.path == "swap" }
          expect(swap).to_not be_nil
        end
      end

      context "if there is a 'generate' with 'mandatory'" do
        let(:config_json) do
          {
            drives: [
              {
                partitions: [
                  { generate: "default" },
                  { generate: "mandatory" }
                ]
              }
            ]
          }
        end

        it "does not include the same partition twice" do
          config = subject.convert
          partitions = config.drives.first.partitions

          expect(partitions.size).to eq(2)

          root = partitions.find { |p| p.filesystem.path == "/" }
          expect(root).to_not be_nil

          swap = partitions.find { |p| p.filesystem.path == "swap" }
          expect(swap).to_not be_nil
        end
      end

      context "if other drive already defines some of the default paths" do
        let(:config_json) do
          {
            drives: [
              {
                partitions: [
                  { generate: "default" }
                ]
              },
              {
                partitions: [
                  {
                    filesystem: { path: "swap" },
                    size:       "2 GiB"
                  }
                ]
              }
            ]
          }
        end

        it "only includes the missing default partitions" do
          config = subject.convert
          partitions0 = config.drives[0].partitions
          partitions1 = config.drives[1].partitions

          expect(partitions0.size).to eq(1)

          root = partitions0.first
          expect(root.filesystem.path).to eq("/")
          expect(root.filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
          expect(root.size.default?).to eq(true)

          expect(partitions1.size).to eq(1)

          swap = partitions1.first
          expect(swap.filesystem.path).to eq("swap")
          expect(swap.filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::SWAP)
          expect(swap.size.default?).to eq(false)
          expect(swap.size.min).to eq(2.GiB)
          expect(swap.size.max).to eq(2.GiB)
        end
      end

      context "if other drive also contains a 'generate'" do
        let(:config_json) do
          {
            drives: [
              {
                partitions: [
                  { generate: "default" }
                ]
              },
              {
                partitions: [
                  { generate: "default" }
                ]
              }
            ]
          }
        end

        it "only includes the default partitions in the first drive" do
          config = subject.convert
          partitions0 = config.drives[0].partitions
          partitions1 = config.drives[1].partitions

          expect(partitions0.size).to eq(2)

          root = partitions0.find { |p| p.filesystem.path == "/" }
          expect(root).to_not be_nil

          swap = partitions0.find { |p| p.filesystem.path == "swap" }
          expect(swap).to_not be_nil

          expect(partitions1.size).to eq(0)
        end
      end
    end

    context "using 'generate' with more properties for partitions in a drive" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                {
                  generate: {
                    partitions: "default",
                    encryption: {
                      luks1: { password: "12345" }
                    }
                  }
                }
              ]
            }
          ]
        }
      end

      it "includes the default partitions defined by the product with the given properties" do
        config = subject.convert
        partitions = config.drives.first.partitions

        expect(partitions.size).to eq(2)

        root = partitions.find { |p| p.filesystem.path == "/" }
        expect(root.filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
        expect(root.size.default?).to eq(true)
        expect(root.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS1)
        expect(root.encryption.password).to eq("12345")

        swap = partitions.find { |p| p.filesystem.path == "swap" }
        expect(swap.filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::SWAP)
        expect(swap.size.default?).to eq(true)
        expect(swap.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS1)
        expect(swap.encryption.password).to eq("12345")
      end
    end

    context "using 'generate' with 'mandatory' for partitions in a drive" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                { generate: "mandatory" }
              ]
            }
          ]
        }
      end

      it "includes the mandatory partitions defined by the product" do
        config = subject.convert
        partitions = config.drives.first.partitions

        expect(partitions.size).to eq(1)

        root = partitions.find { |p| p.filesystem.path == "/" }
        expect(root.filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
        expect(root.size.default?).to eq(true)
      end

      context "if other device already defines some of the mandatory paths" do
        let(:config_json) do
          {
            drives:       [
              {
                partitions: [
                  { generate: "mandatory" }
                ]
              }
            ],
            volumeGroups: [
              {
                logicalVolumes: [
                  {
                    filesystem: { path: "/" }
                  }
                ]
              }
            ]
          }
        end

        it "does not include the already defined mandatory paths" do
          config = subject.convert
          partitions = config.drives.first.partitions
          logical_volumes = config.volume_groups.first.logical_volumes

          expect(partitions.size).to eq(0)
        end
      end
    end

    context "using 'generate' with 'default' for logical volumes" do
      let(:config_json) do
        {
          volumeGroups: [
            {
              logicalVolumes: [
                { generate: "default" }
              ]
            }
          ]
        }
      end

      it "includes the default logical volumes defined by the product" do
        config = subject.convert
        logical_volumes = config.volume_groups.first.logical_volumes

        expect(logical_volumes.size).to eq(2)

        root = logical_volumes.find { |v| v.filesystem.path == "/" }
        expect(root.filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
        expect(root.size.default?).to eq(true)

        swap = logical_volumes.find { |v| v.filesystem.path == "swap" }
        expect(swap.filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::SWAP)
        expect(swap.size.default?).to eq(true)
      end

      context "if other device already defines any of the default paths" do
        let(:config_json) do
          {
            drives:       [
              {
                partitions: [
                  {
                    filesystem: { path: "/" }
                  }
                ]
              }
            ],
            volumeGroups: [
              {
                logicalVolumes: [
                  { generate: "default" }
                ]
              }
            ]
          }
        end

        it "does not include the already defined default paths" do
          config = subject.convert
          logical_volumes = config.volume_groups.first.logical_volumes

          expect(logical_volumes.size).to eq(1)

          swap = logical_volumes.first
          expect(swap.filesystem.path).to eq("swap")
        end
      end
    end

    context "using 'generate' with 'mandatory' for logical volumes" do
      let(:config_json) do
        {
          volumeGroups: [
            {
              logicalVolumes: [
                { generate: "mandatory" }
              ]
            }
          ]
        }
      end

      it "includes the mandatory logical volumes defined by the product" do
        config = subject.convert
        logical_volumes = config.volume_groups.first.logical_volumes

        expect(logical_volumes.size).to eq(1)

        root = logical_volumes.first
        expect(root.filesystem.path).to eq("/")
        expect(root.filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
        expect(root.size.default?).to eq(true)
      end

      context "if other device already defines any of the mandatory paths" do
        let(:config_json) do
          {
            drives:       [
              {
                partitions: [
                  {
                    filesystem: { path: "/" }
                  }
                ]
              }
            ],
            volumeGroups: [
              {
                logicalVolumes: [
                  { generate: "mandatory" }
                ]
              }
            ]
          }
        end

        it "does not include the already defined mandatory paths" do
          config = subject.convert
          logical_volumes = config.volume_groups.first.logical_volumes

          expect(logical_volumes.size).to eq(0)
        end
      end
    end

    context "using both 'generate' with 'default' and with 'mandatory'" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                first_generate,
                second_generate
              ]
            }
          ]
        }
      end

      context "if 'default' appears first" do
        let(:first_generate) { { generate: "default" } }
        let(:second_generate) { { generate: "mandatory" } }

        it "includes the default partitions defined by the product" do
          config = subject.convert
          partitions = config.drives.first.partitions

          expect(partitions.size).to eq(2)

          root = partitions.find { |p| p.filesystem.path == "/" }
          swap = partitions.find { |p| p.filesystem.path == "swap" }

          expect(root).to_not be_nil
          expect(swap).to_not be_nil
        end
      end

      context "if 'mandatory' appears first" do
        let(:first_generate) { { generate: "mandatory" } }
        let(:second_generate) { { generate: "default" } }

        it "includes the mandatory partitions defined by the product" do
          config = subject.convert
          partitions = config.drives.first.partitions

          expect(partitions.size).to eq(1)

          root = partitions.find { |p| p.filesystem.path == "/" }
          expect(root).to_not be_nil
        end
      end
    end
  end
end
