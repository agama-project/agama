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

require_relative "./storage_helpers"
require "agama/config"
require "agama/storage/config_conversions"
require "agama/storage/config_solver"
require "y2storage"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

describe Agama::Storage::ConfigSolver do
  include Agama::RSpec::StorageHelpers

  let(:product_data) do
    {
      "storage" => {
        "lvm"              => false,
        "space_policy"     => "delete",
        "encryption"       => {
          "method"        => "luks2",
          "pbkd_function" => "argon2i"
        },
        "volumes"          => ["/", "swap"],
        "volume_templates" => [
          {
            "mount_path" => "/", "filesystem" => "btrfs",
            "size" => { "auto" => true, "min" => "5 GiB", "max" => "10 GiB" },
            "btrfs" => {
              "snapshots" => true, "default_subvolume" => "@", "read_only" => true,
              "subvolumes" => ["home", "opt", "root", "srv"]
            },
            "outline" => {
              "required" => true, "snapshots_configurable" => true,
              "auto_size" => {
                "base_min" => "5 GiB", "base_max" => "10 GiB",
                "min_fallback_for" => min_fallbacks, "max_fallback_for" => max_fallbacks,
                "snapshots_increment" => snapshots_increment
              }
            }
          },
          {
            "mount_path" => "/home", "size" => { "auto" => false, "min" => "5 GiB" },
            "filesystem" => "xfs", "outline" => { "required" => false }
          },
          {
            "mount_path" => "swap", "filesystem" => "swap", "size" => { "auto" => true },
            "outline"    => {
              "auto_size" => {
                "adjust_by_ram" => true,
                "base_min"      => "2 GiB",
                "base_max"      => "4 GiB"
              }
            }
          },
          { "mount_path" => "", "filesystem" => "ext4",
            "size" => { "min" => "100 MiB" } }
        ]
      }
    }
  end

  let(:min_fallbacks) { [] }

  let(:max_fallbacks) { [] }

  let(:snapshots_increment) { nil }

  let(:product_config) { Agama::Config.new(product_data) }

  let(:default_paths) { product_config.default_paths }

  let(:mandatory_paths) { product_config.mandatory_paths }

  let(:config_json) { nil }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSON
      .new(config_json)
      .convert
  end

  let(:devicegraph) { Y2Storage::StorageManager.instance.probed }

  before do
    mock_storage(devicegraph: scenario)
    # To speed-up the tests
    allow(Y2Storage::EncryptionMethod::TPM_FDE)
      .to(receive(:possible?))
      .and_return(true)
  end

  subject { described_class.new(devicegraph, product_config) }

  describe "#solve" do
    let(:scenario) { "empty-hd-50GiB.yaml" }

    context "if a config does not specify all the encryption properties" do
      let(:config_json) do
        {
          drives: [
            {
              encryption: {
                luks2: { password: "12345" }
              }
            }
          ]
        }
      end

      it "completes the encryption config according to the product info" do
        subject.solve(config)

        drive = config.drives.first
        encryption = drive.encryption
        expect(encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
        expect(encryption.password).to eq("12345")
        expect(encryption.pbkd_function).to eq(Y2Storage::PbkdFunction::ARGON2I)
      end
    end

    context "if a volume group does not specify all the pv encryption properties" do
      let(:config_json) do
        {
          volumeGroups: [
            {
              physicalVolumes: [
                {
                  generate: {
                    encryption: {
                      luks2: { password: "12345" }
                    }
                  }
                }
              ]
            }
          ]
        }
      end

      it "completes the encryption config according to the product info" do
        subject.solve(config)

        volume_group = config.volume_groups.first
        encryption = volume_group.physical_volumes_encryption
        expect(encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
        expect(encryption.password).to eq("12345")
        expect(encryption.pbkd_function).to eq(Y2Storage::PbkdFunction::ARGON2I)
      end
    end

    context "if a config does not specify all the filesystem properties" do
      let(:config_json) do
        {
          drives: [
            {
              filesystem: { path: "/" }
            }
          ]
        }
      end

      it "completes the filesystem config according to the product info" do
        subject.solve(config)

        drive = config.drives.first
        filesystem = drive.filesystem
        expect(filesystem.type).to be_a(Agama::Storage::Configs::FilesystemType)
        expect(filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
        expect(filesystem.type.btrfs).to be_a(Agama::Storage::Configs::Btrfs)
        expect(filesystem.type.btrfs.snapshots?).to eq(true)
        expect(filesystem.type.btrfs.read_only?).to eq(true)
        expect(filesystem.type.btrfs.default_subvolume).to eq("@")
        expect(filesystem.type.btrfs.subvolumes).to all(be_a(Y2Storage::SubvolSpecification))
      end
    end

    context "if a config does not specify all the btrfs properties" do
      let(:config_json) do
        {
          drives: [
            {
              filesystem: {
                path: "/",
                type: {
                  btrfs: {
                    snapshots: false
                  }
                }
              }
            }
          ]
        }
      end

      it "completes the btrfs config according to the product info" do
        subject.solve(config)

        drive = config.drives.first
        btrfs = drive.filesystem.type.btrfs
        expect(btrfs.snapshots?).to eq(false)
        expect(btrfs.read_only?).to eq(true)
        expect(btrfs.default_subvolume).to eq("@")
        expect(btrfs.subvolumes).to all(be_a(Y2Storage::SubvolSpecification))
      end
    end

    partition_proc = proc { |c| c.drives.first.partitions.first }

    context "if a config does not specify size" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: partitions
            }
          ]
        }
      end

      let(:partitions) do
        [
          {
            filesystem: { path: "/" }
          },
          {
            filesystem: { path: "/home" }
          },
          {}
        ]
      end

      let(:scenario) { "disks.yaml" }

      it "sets a size according to the product info" do
        subject.solve(config)

        drive = config.drives.first
        p1, p2, p3 = drive.partitions

        expect(p1.size.default?).to eq(true)
        expect(p1.size.min).to eq(5.GiB)
        expect(p1.size.max).to eq(10.GiB)

        expect(p2.size.default?).to eq(true)
        expect(p2.size.min).to eq(5.GiB)
        expect(p2.size.max).to eq(Y2Storage::DiskSize.unlimited)

        expect(p3.size.default?).to eq(true)
        expect(p3.size.min).to eq(100.MiB)
        expect(p3.size.max).to eq(Y2Storage::DiskSize.unlimited)
      end

      context "and there is a device assigned" do
        let(:partitions) do
          [
            {
              search:     "/dev/vda2",
              filesystem: { path: "/" }
            }
          ]
        end

        # Enable fallbacks and snapshots to check they don't affect in this case.
        let(:min_fallbacks) { ["/home"] }
        let(:max_fallbacks) { ["/home"] }
        let(:snapshots_increment) { "300%" }

        it "sets the device size" do
          subject.solve(config)
          partition = partition_proc.call(config)
          expect(partition.size.default?).to eq(false)
          expect(partition.size.min).to eq(20.GiB)
          expect(partition.size.max).to eq(20.GiB)
        end
      end

      context "and the product defines size fallbacks" do
        let(:min_fallbacks) { ["/home"] }
        let(:max_fallbacks) { ["/home"] }
        let(:snapshots_increment) { "300%" }

        context "and the config does not specify some of the paths" do
          let(:partitions) do
            [
              {
                filesystem: {
                  type: "xfs",
                  path: "/"
                }
              }
            ]
          end

          it "sets a size adding the fallback sizes" do
            subject.solve(config)
            partition = partition_proc.call(config)
            expect(partition.size.default?).to eq(true)
            expect(partition.size.min).to eq(10.GiB)
            expect(partition.size.max).to eq(Y2Storage::DiskSize.unlimited)
          end

          context "and snapshots are enabled" do
            let(:partitions) do
              [
                {
                  filesystem: {
                    type: "btrfs",
                    path: "/"
                  }
                }
              ]
            end

            it "sets a size adding the fallback and snapshots sizes" do
              subject.solve(config)
              partition = partition_proc.call(config)
              expect(partition.size.default?).to eq(true)
              expect(partition.size.min).to eq(40.GiB)
              expect(partition.size.max).to eq(Y2Storage::DiskSize.unlimited)
            end
          end
        end

        context "and the config specifies the fallback paths" do
          let(:partitions) do
            [
              {
                filesystem: {
                  type: filesystem,
                  path: "/"
                }
              },
              {
                filesystem: { path: "/home" }
              }
            ]
          end

          let(:filesystem) { "xfs" }

          it "sets a size ignoring the fallback sizes" do
            subject.solve(config)
            partition = partition_proc.call(config)
            expect(partition.size.default?).to eq(true)
            expect(partition.size.min).to eq(5.GiB)
            expect(partition.size.max).to eq(10.GiB)
          end

          context "and snapshots are enabled" do
            let(:filesystem) { "btrfs" }

            it "sets a size adding the snapshots size" do
              subject.solve(config)
              partition = partition_proc.call(config)
              expect(partition.size.default?).to eq(true)
              expect(partition.size.min).to eq(20.GiB)
              expect(partition.size.max).to eq(40.GiB)
            end
          end
        end
      end

      context "and the volume has to be enlarged according to RAM size" do
        before do
          allow_any_instance_of(Y2Storage::Arch).to receive(:ram_size).and_return(8.GiB)
        end

        let(:partitions) do
          [
            {
              filesystem: { path: "swap" }
            }
          ]
        end

        it "sets the RAM size" do
          subject.solve(config)
          partition = partition_proc.call(config)
          expect(partition.size.default?).to eq(true)
          expect(partition.size.min).to eq(8.GiB)
          expect(partition.size.max).to eq(8.GiB)
        end
      end
    end

    context "if a config specifies a size" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                {
                  search:     search,
                  filesystem: { path: "/" },
                  size:       {
                    min: "10 GiB",
                    max: "15 GiB"
                  }
                }
              ]
            }
          ]
        }
      end

      let(:scenario) { "disks.yaml" }

      # Enable fallbacks and snapshots to check they don't affect in this case.
      let(:min_fallbacks) { ["/home"] }
      let(:max_fallbacks) { ["/home"] }
      let(:snapshots_increment) { "300%" }

      context "and there is no device assigned" do
        let(:search) { nil }

        it "sets the given size" do
          subject.solve(config)
          partition = partition_proc.call(config)
          expect(partition.size.default?).to eq(false)
          expect(partition.size.min).to eq(10.GiB)
          expect(partition.size.max).to eq(15.GiB)
        end
      end

      context "and there is a device assigned" do
        let(:search) { "/dev/vda2" }

        it "sets the given size" do
          subject.solve(config)
          partition = partition_proc.call(config)
          expect(partition.size.default?).to eq(false)
          expect(partition.size.min).to eq(10.GiB)
          expect(partition.size.max).to eq(15.GiB)
        end
      end
    end

    context "if a config specifies 'current' for min size" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                {
                  search:     search,
                  filesystem: { path: "/" },
                  size:       {
                    min: "current",
                    max: "40 GiB"
                  }
                }
              ]
            }
          ]
        }
      end

      context "and there is no device assigned" do
        let(:search) { nil }

        it "sets a size according to the product info" do
          subject.solve(config)
          partition = partition_proc.call(config)
          expect(partition.size.default?).to eq(true)
          expect(partition.size.min).to eq(5.GiB)
          expect(partition.size.max).to eq(10.GiB)
        end
      end

      context "and there is a device assigned" do
        let(:scenario) { "disks.yaml" }

        let(:search) { "/dev/vda2" }

        it "sets the device size as min size" do
          subject.solve(config)
          partition = partition_proc.call(config)
          expect(partition.size.default?).to eq(false)
          expect(partition.size.min).to eq(20.GiB)
          expect(partition.size.max).to eq(40.GiB)
        end
      end
    end

    context "if a config specifies 'current' for max size" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                {
                  search:     search,
                  filesystem: { path: "/" },
                  size:       {
                    min: "10 GiB",
                    max: "current"
                  }
                }
              ]
            }
          ]
        }
      end

      context "and there is no device assigned" do
        let(:search) { nil }

        it "sets a size according to the product info" do
          subject.solve(config)
          partition = partition_proc.call(config)
          expect(partition.size.default?).to eq(true)
          expect(partition.size.min).to eq(5.GiB)
          expect(partition.size.max).to eq(10.GiB)
        end
      end

      context "and there is a device assigned" do
        let(:scenario) { "disks.yaml" }

        let(:search) { "/dev/vda2" }

        it "sets the device size as max size" do
          subject.solve(config)
          partition = partition_proc.call(config)
          expect(partition.size.default?).to eq(false)
          expect(partition.size.min).to eq(10.GiB)
          expect(partition.size.max).to eq(20.GiB)
        end
      end
    end
  end

  context "if a drive omits the search" do
    let(:config_json) { { drives: drives } }

    let(:drives) do
      [
        {},
        {},
        {}
      ]
    end

    let(:scenario) { "disks.yaml" }

    it "sets the first unassigned device to the drive" do
      subject.solve(config)
      search1, search2, search3 = config.drives.map(&:search)
      expect(search1.solved?).to eq(true)
      expect(search1.device.name).to eq("/dev/vda")
      expect(search2.solved?).to eq(true)
      expect(search2.device.name).to eq("/dev/vdb")
      expect(search3.solved?).to eq(true)
      expect(search3.device.name).to eq("/dev/vdc")
    end

    context "and there is not unassigned device" do
      let(:drives) do
        [
          {},
          {},
          {},
          {}
        ]
      end

      it "does not set a device to the drive" do
        subject.solve(config)
        search = config.drives[3].search
        expect(search.solved?).to eq(true)
        expect(search.device).to be_nil
      end
    end
  end

  context "if a drive contains an empty search" do
    let(:config_json) { { drives: drives } }

    let(:drives) do
      [
        { search: {} }
      ]
    end

    let(:scenario) { "disks.yaml" }

    it "expands the number of drives to match all the existing disks" do
      subject.solve(config)
      expect(config.drives.size).to eq 3
      search1, search2, search3 = config.drives.map(&:search)
      expect(search1.solved?).to eq(true)
      expect(search1.device.name).to eq("/dev/vda")
      expect(search2.solved?).to eq(true)
      expect(search2.device.name).to eq("/dev/vdb")
      expect(search3.solved?).to eq(true)
      expect(search3.device.name).to eq("/dev/vdc")
    end
  end

  context "if a drive contains a search with '*'" do
    let(:config_json) { { drives: drives } }

    let(:drives) do
      [
        { search: "*" }
      ]
    end

    let(:scenario) { "disks.yaml" }

    it "expands the number of drives to match all the existing disks" do
      subject.solve(config)
      expect(config.drives.size).to eq 3
      expect(config.drives.map(&:search).map(&:solved?)).to all(eq(true))
      expect(config.drives.map(&:search).map(&:device).map(&:name))
        .to eq ["/dev/vda", "/dev/vdb", "/dev/vdc"]
    end
  end

  context "if a drive contains a search with no conditions but with a max" do
    let(:config_json) { { drives: drives } }

    let(:drives) do
      [
        { search: { max: max } }
      ]
    end

    let(:scenario) { "disks.yaml" }

    context "and the max is equal or smaller than the number of disks" do
      let(:max) { 2 }

      it "expands the number of drives to match the max" do
        subject.solve(config)
        expect(config.drives.size).to eq 2
        expect(config.drives.map(&:search).map(&:solved?)).to all(eq(true))
        expect(config.drives.map(&:search).map(&:device).map(&:name))
          .to eq ["/dev/vda", "/dev/vdb"]
      end
    end

    context "and the max is bigger than the number of disks" do
      let(:max) { 20 }

      it "expands the number of drives to match all the existing disks" do
        subject.solve(config)
        expect(config.drives.size).to eq 3
        expect(config.drives.map(&:search).map(&:solved?)).to all(eq(true))
        expect(config.drives.map(&:search).map(&:device).map(&:name))
          .to eq ["/dev/vda", "/dev/vdb", "/dev/vdc"]
      end
    end
  end

  context "if a drive has a search with a device name" do
    let(:config_json) { { drives: drives } }

    let(:drives) do
      [
        { search: search }
      ]
    end

    let(:scenario) { "disks.yaml" }

    context "and the device is found" do
      let(:search) { "/dev/vdb" }

      it "sets the device to the drive" do
        subject.solve(config)
        search = config.drives.first.search
        expect(search.solved?).to eq(true)
        expect(search.device.name).to eq("/dev/vdb")
      end
    end

    context "and the device is not found" do
      let(:search) { "/dev/vdd" }

      # Speed-up fallback search (and make sure it fails)
      before { allow(Y2Storage::BlkDevice).to receive(:find_by_any_name) }

      it "does not set a device to the drive" do
        subject.solve(config)
        search = config.drives.first.search
        expect(search.solved?).to eq(true)
        expect(search.device).to be_nil
      end
    end

    context "and the device was already assigned" do
      let(:drives) do
        [
          {},
          { search: "/dev/vda" }
        ]
      end

      it "does not set a device to the drive" do
        subject.solve(config)
        search = config.drives[1].search
        expect(search.solved?).to eq(true)
        expect(search.device).to be_nil
      end
    end

    context "and there is other drive with the same device" do
      let(:drives) do
        [
          { search: "/dev/vdb" },
          { search: "/dev/vdb" }
        ]
      end

      it "only sets the device to the first drive" do
        subject.solve(config)
        search1, search2 = config.drives.map(&:search)
        expect(search1.solved?).to eq(true)
        expect(search1.device.name).to eq("/dev/vdb")
        expect(search2.solved?).to eq(true)
        expect(search2.device).to be_nil
      end
    end
  end

  context "if a partition has an empty search" do
    let(:config_json) do
      {
        drives: [{ partitions: partitions }]
      }
    end

    let(:partitions) do
      [
        { search: {} }
      ]
    end

    let(:scenario) { "disks.yaml" }

    it "expands the number of partition configs to match all the existing partitions" do
      subject.solve(config)
      drive_partitions = config.drives.first.partitions
      expect(drive_partitions.size).to eq 3
      search1, search2, search3 = drive_partitions.map(&:search)
      expect(search1.solved?).to eq(true)
      expect(search1.device.name).to eq("/dev/vda1")
      expect(search2.solved?).to eq(true)
      expect(search2.device.name).to eq("/dev/vda2")
      expect(search3.solved?).to eq(true)
      expect(search3.device.name).to eq("/dev/vda3")
    end

    context "and there are more partition searches without name" do
      let(:partitions) do
        [
          { search: {} },
          { search: {} },
          { search: "*" }
        ]
      end

      it "does not set a device to the surpluss configs" do
        subject.solve(config)
        drive_partitions = config.drives.first.partitions
        expect(drive_partitions.size).to eq 5
        searches = drive_partitions[3..-1].map(&:search)
        expect(searches.map(&:solved?)).to eq [true, true]
        expect(searches.map(&:device)).to eq [nil, nil]
      end
    end
  end

  context "if a partition has '*' as search" do
    let(:config_json) do
      {
        drives: [{ partitions: [{ search: "*" }] }]
      }
    end

    let(:scenario) { "disks.yaml" }

    it "expands the number of partition configs to match all the existing partitions" do
      subject.solve(config)
      drive_partitions = config.drives.first.partitions
      expect(drive_partitions.size).to eq 3
      expect(drive_partitions.map(&:search).map(&:solved?)).to all(eq(true))
      expect(drive_partitions.map(&:search).map(&:device).map(&:name))
        .to eq ["/dev/vda1", "/dev/vda2", "/dev/vda3"]
    end
  end

  context "if a partition has a search with a device name" do
    let(:config_json) do
      {
        drives: [{ partitions: partitions }]
      }
    end

    let(:partitions) do
      [
        { search: search }
      ]
    end

    let(:scenario) { "disks.yaml" }

    search_proc = proc { |c| c.drives.first.partitions.first.search }

    context "and the partition is found" do
      let(:search) { "/dev/vda2" }

      it "sets the partition to the config" do
        subject.solve(config)
        search = search_proc.call(config)
        expect(search.solved?).to eq(true)
        expect(search.device.name).to eq("/dev/vda2")
      end
    end

    context "and the device is not found" do
      let(:search) { "/dev/vdb1" }

      # Speed-up fallback search (and make sure it fails)
      before { allow(Y2Storage::BlkDevice).to receive(:find_by_any_name) }

      it "does not set a partition to the config" do
        subject.solve(config)
        search = search_proc.call(config)
        expect(search.solved?).to eq(true)
        expect(search.device).to be_nil
      end
    end

    context "and the device was already assigned" do
      let(:partitions) do
        [
          { search: {} },
          { search: "/dev/vda1" }
        ]
      end

      it "does not set a partition to the config" do
        subject.solve(config)
        search = config.drives.first.partitions.last.search
        expect(search.solved?).to eq(true)
        expect(search.device).to be_nil
      end
    end

    context "and there is other partition with the same device" do
      let(:partitions) do
        [
          { search: "/dev/vda2" },
          { search: "/dev/vda2" }
        ]
      end

      it "only sets the partition to the first config" do
        subject.solve(config)
        search1, search2 = config.drives.first.partitions.map(&:search)
        expect(search1.solved?).to eq(true)
        expect(search1.device.name).to eq("/dev/vda2")
        expect(search2.solved?).to eq(true)
        expect(search2.device).to be_nil
      end
    end
  end

  context "if a partition config contains a search with no conditions but with a max" do
    let(:config_json) do
      {
        drives: [{ partitions: [{ search: { max: max } }] }]
      }
    end

    let(:scenario) { "disks.yaml" }

    context "and the max is equal or smaller than the number of partitions on the device" do
      let(:max) { 2 }

      it "expands the number of partition configs to match the max" do
        subject.solve(config)
        drive_partitions = config.drives.first.partitions
        expect(drive_partitions.size).to eq 2
        expect(drive_partitions.map(&:search).map(&:solved?)).to all(eq(true))
        expect(drive_partitions.map(&:search).map(&:device).map(&:name))
          .to eq ["/dev/vda1", "/dev/vda2"]
      end
    end

    context "and the max is bigger than the number of partitions on the device" do
      let(:max) { 20 }

      it "expands the number of configs to match all the existing partitions" do
        subject.solve(config)
        drive_partitions = config.drives.first.partitions
        expect(drive_partitions.size).to eq 3
        expect(drive_partitions.map(&:search).map(&:solved?)).to all(eq(true))
        expect(drive_partitions.map(&:search).map(&:device).map(&:name))
          .to eq ["/dev/vda1", "/dev/vda2", "/dev/vda3"]
      end
    end
  end
end
