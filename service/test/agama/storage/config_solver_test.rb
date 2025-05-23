# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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

require_relative "./config_context"
require "agama/storage/config_solver"
require "agama/storage/system"
require "y2storage"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

describe Agama::Storage::ConfigSolver do
  include_context "config"

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

  let(:default_paths) { product_config.default_paths }

  let(:mandatory_paths) { product_config.mandatory_paths }

  let(:storage_system) { Agama::Storage::System.new }

  subject { described_class.new(product_config, storage_system) }

  describe "#solve" do
    let(:scenario) { "empty-hd-50GiB.yaml" }

    context "if a config does not specify the boot device alias" do
      let(:config_json) do
        {
          boot:   { configure: true },
          drives: [
            {
              alias:      "root",
              partitions: [
                {
                  filesystem: { path: "/" }
                }
              ]
            }
          ]
        }
      end

      it "solves the boot device" do
        subject.solve(config)
        expect(config.boot.device.device_alias).to eq("root")
      end
    end

    shared_examples "encryption" do |encryption_proc|
      context "if some encryption properties are missing" do
        let(:encryption) do
          {
            luks2: { password: "12345" }
          }
        end

        it "completes the encryption config according to the product info" do
          subject.solve(config)

          encryption = encryption_proc.call(config)
          expect(encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
          expect(encryption.password).to eq("12345")
          expect(encryption.pbkd_function).to eq(Y2Storage::PbkdFunction::ARGON2I)
        end
      end
    end

    shared_examples "filesystem" do |filesystem_proc|
      context "if some filesystem properties are missing" do
        let(:filesystem) { { path: "/" } }

        it "completes the filesystem config according to the product info" do
          subject.solve(config)

          filesystem = filesystem_proc.call(config)
          expect(filesystem.type).to be_a(Agama::Storage::Configs::FilesystemType)
          expect(filesystem.type.default?).to eq(true)
          expect(filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
          expect(filesystem.type.btrfs).to be_a(Agama::Storage::Configs::Btrfs)
          expect(filesystem.type.btrfs.snapshots?).to eq(true)
          expect(filesystem.type.btrfs.read_only?).to eq(true)
          expect(filesystem.type.btrfs.default_subvolume).to eq("@")
          expect(filesystem.type.btrfs.subvolumes).to all(be_a(Y2Storage::SubvolSpecification))
        end
      end

      context "if some btrfs properties are missing" do
        let(:filesystem) do
          {
            path: "/",
            type: {
              btrfs: {
                snapshots: false
              }
            }
          }
        end

        it "completes the btrfs config according to the product info" do
          subject.solve(config)

          filesystem = filesystem_proc.call(config)
          btrfs = filesystem.type.btrfs
          expect(btrfs.snapshots?).to eq(false)
          expect(btrfs.read_only?).to eq(true)
          expect(btrfs.default_subvolume).to eq("@")
          expect(btrfs.subvolumes).to all(be_a(Y2Storage::SubvolSpecification))
        end
      end
    end

    shared_examples "block device" do |device_proc|
      encryption_proc = proc { |c| device_proc.call(c).encryption }
      include_examples "encryption", encryption_proc

      filesystem_proc = proc { |c| device_proc.call(c).filesystem }
      include_examples "filesystem", filesystem_proc
    end

    shared_examples "new volume size" do |volumes_proc|
      let(:scenario) { "disks.yaml" }

      let(:min_fallbacks) { ["/home"] }
      let(:max_fallbacks) { ["/home"] }
      let(:snapshots_increment) { "300%" }

      let(:volumes) { [volume] }

      let(:volume) do
        {
          filesystem: {
            type: volume_filesystem,
            path: "/"
          },
          size:       size
        }
      end

      let(:volume_filesystem) { "xfs" }

      context "if size is missing" do
        let(:size) { nil }

        context "and some paths are missing" do
          it "sets a size adding the fallback sizes" do
            subject.solve(config)
            volume = volumes_proc.call(config).first
            expect(volume.size.default?).to eq(true)
            expect(volume.size.min).to eq(10.GiB)
            expect(volume.size.max).to eq(Y2Storage::DiskSize.unlimited)
          end

          context "and snapshots are enabled" do
            let(:volume_filesystem) { "btrfs" }

            it "sets a size adding the fallback and snapshots sizes" do
              subject.solve(config)
              volume = volumes_proc.call(config).first
              expect(volume.size.default?).to eq(true)
              expect(volume.size.min).to eq(40.GiB)
              expect(volume.size.max).to eq(Y2Storage::DiskSize.unlimited)
            end
          end

          context "and no paths are missing" do
            let(:volumes) do
              [
                volume,
                {
                  filesystem: { path: "/home" }
                }
              ]
            end

            it "sets a size ignoring the fallback sizes" do
              subject.solve(config)
              volume = volumes_proc.call(config).first
              expect(volume.size.default?).to eq(true)
              expect(volume.size.min).to eq(5.GiB)
              expect(volume.size.max).to eq(10.GiB)
            end

            context "and snapshots are enabled" do
              let(:volume_filesystem) { "btrfs" }

              it "sets a size adding the snapshots size" do
                subject.solve(config)
                volume = volumes_proc.call(config).first
                expect(volume.size.default?).to eq(true)
                expect(volume.size.min).to eq(20.GiB)
                expect(volume.size.max).to eq(40.GiB)
              end
            end
          end
        end

        context "and has to be enlarged according to RAM size" do
          before do
            allow_any_instance_of(Y2Storage::Arch).to receive(:ram_size).and_return(8.GiB)
          end

          let(:volume) do
            { filesystem: { path: "swap" } }
          end

          it "sets the RAM size" do
            subject.solve(config)
            volume = volumes_proc.call(config).first
            expect(volume.size.default?).to eq(true)
            expect(volume.size.min).to eq(8.GiB)
            expect(volume.size.max).to eq(8.GiB)
          end
        end
      end

      context "if size is not missing" do
        let(:size) { { min: "10 GiB", max: "15 GiB" } }

        it "sets the given size" do
          subject.solve(config)
          volume = volumes_proc.call(config).first
          expect(volume.size.default?).to eq(false)
          expect(volume.size.min).to eq(10.GiB)
          expect(volume.size.max).to eq(15.GiB)
        end
      end

      context "if min size is 'current'" do
        let(:size) { { min: "current", max: "15 GiB" } }

        let(:min_fallbacks) { [] }
        let(:max_fallbacks) { [] }

        it "sets a size according to the product info" do
          subject.solve(config)
          volume = volumes_proc.call(config).first
          expect(volume.size.default?).to eq(true)
          expect(volume.size.min).to eq(5.GiB)
          expect(volume.size.max).to eq(10.GiB)
        end
      end

      context "if max size is 'current" do
        let(:size) { { min: "10 GiB", max: "current" } }

        let(:min_fallbacks) { [] }
        let(:max_fallbacks) { [] }

        it "sets a size according to the product info" do
          subject.solve(config)
          volume = volumes_proc.call(config).first
          expect(volume.size.default?).to eq(true)
          expect(volume.size.min).to eq(5.GiB)
          expect(volume.size.max).to eq(10.GiB)
        end
      end

      context "if max size is missing" do
        let(:size) { { min: "10 GiB" } }

        it "sets max size to unlimited" do
          subject.solve(config)
          volume = volumes_proc.call(config).first
          expect(volume.size.default?).to eq(false)
          expect(volume.size.min).to eq(10.GiB)
          expect(volume.size.max).to eq(Y2Storage::DiskSize.unlimited)
        end
      end
    end

    shared_examples "partition" do |partitions_proc|
      context "for a partition" do
        let(:partitions) do
          [
            {
              encryption: encryption,
              filesystem: filesystem
            }
          ]
        end

        let(:encryption) { nil }
        let(:filesystem) { nil }

        partition_proc = proc { |c| partitions_proc.call(c).first }
        include_examples "block device", partition_proc
      end
    end

    shared_examples "new partition size" do |partitions_proc|
      context "for a new partition" do
        let(:partitions) { volumes }
        include_examples "new volume size", partitions_proc
      end
    end

    shared_examples "reused partition size" do |partitions_proc|
      context "for a reused partition" do
        let(:scenario) { "disks.yaml" }

        # Enable fallbacks and snapshots to check they don't affect in this case.
        let(:min_fallbacks) { ["/home"] }
        let(:max_fallbacks) { ["/home"] }
        let(:snapshots_increment) { "300%" }

        let(:partitions) do
          [
            {
              search:     "/dev/vda2",
              filesystem: { path: "/" },
              size:       size
            }
          ]
        end

        context "if size is missing" do
          let(:size) { nil }

          it "sets the device size" do
            subject.solve(config)
            partition = partitions_proc.call(config).first
            expect(partition.size.default?).to eq(true)
            expect(partition.size.min).to eq(20.GiB)
            expect(partition.size.max).to eq(20.GiB)
          end
        end

        context "if size is not missing" do
          let(:size) { { min: "10 GiB", max: "15 GiB" } }

          it "sets the given size" do
            subject.solve(config)
            partition = partitions_proc.call(config).first
            expect(partition.size.default?).to eq(false)
            expect(partition.size.min).to eq(10.GiB)
            expect(partition.size.max).to eq(15.GiB)
          end
        end

        context "if min size is 'current'" do
          let(:size) { { min: "current", max: "40 GiB" } }

          it "sets the device size as min size" do
            subject.solve(config)
            partition = partitions_proc.call(config).first
            expect(partition.size.default?).to eq(false)
            expect(partition.size.min).to eq(20.GiB)
            expect(partition.size.max).to eq(40.GiB)
          end
        end

        context "if max size is 'current'" do
          let(:size) { { min: "10 GiB", max: "current" } }

          it "sets the device size as max size" do
            subject.solve(config)
            partition = partitions_proc.call(config).first
            expect(partition.size.default?).to eq(false)
            expect(partition.size.min).to eq(10.GiB)
            expect(partition.size.max).to eq(20.GiB)
          end
        end

        context "if max size is missing" do
          let(:size) { { min: "10 GiB" } }

          it "sets max size to unlimited" do
            subject.solve(config)
            partition = partitions_proc.call(config).first
            expect(partition.size.default?).to eq(false)
            expect(partition.size.min).to eq(10.GiB)
            expect(partition.size.max).to eq(Y2Storage::DiskSize.unlimited)
          end
        end
      end
    end

    context "for a drive config" do
      let(:scenario) { "disks.yaml" }

      let(:config_json) { { drives: drives } }

      let(:drives) do
        [
          {
            encryption: encryption,
            filesystem: filesystem,
            partitions: partitions
          }
        ]
      end

      let(:encryption) { nil }
      let(:filesystem) { nil }
      let(:partitions) { [] }

      it "solves the search" do
        subject.solve(config)
        drive = config.drives.first
        expect(drive.search.solved?).to eq(true)
        expect(drive.search.device.name).to eq("/dev/vda")
      end

      encryption_proc = proc { |c| c.drives.first.encryption }
      include_examples "encryption", encryption_proc

      filesystem_proc = proc { |c| c.drives.first.filesystem }
      include_examples "filesystem", filesystem_proc

      partitions_proc = proc { |c| c.drives.first.partitions }
      include_examples "partition", partitions_proc
      include_examples "new partition size", partitions_proc
      include_examples "reused partition size", partitions_proc
    end

    context "for a MD RAID" do
      let(:scenario) { "md_raids.yaml" }

      let(:config_json) do
        {
          mdRaids: [
            {
              search:     { max: 1 },
              encryption: encryption,
              filesystem: filesystem,
              partitions: partitions
            }
          ]
        }
      end

      let(:encryption) { nil }
      let(:filesystem) { nil }
      let(:partitions) { [] }

      it "solves the search" do
        subject.solve(config)
        md = config.md_raids.first
        expect(md.search.solved?).to eq(true)
        expect(md.search.device.name).to eq("/dev/md0")
      end

      encryption_proc = proc { |c| c.md_raids.first.encryption }
      include_examples "encryption", encryption_proc

      filesystem_proc = proc { |c| c.md_raids.first.filesystem }
      include_examples "filesystem", filesystem_proc

      partitions_proc = proc { |c| c.md_raids.first.partitions }
      include_examples "partition", partitions_proc
      include_examples "new partition size", partitions_proc
    end

    context "for a volume group config" do
      let(:config_json) do
        {
          volumeGroups: [
            {
              physicalVolumes: physical_volumes,
              logicalVolumes:  logical_volumes
            }
          ]
        }
      end

      let(:physical_volumes) { [] }
      let(:logical_volumes) { [] }

      context "if encryption is specified for physical volumes" do
        let(:physical_volumes) do
          [
            {
              generate: {
                encryption: encryption
              }
            }
          ]
        end

        encryption_proc = proc { |c| c.volume_groups.first.physical_volumes_encryption }
        include_examples "encryption", encryption_proc
      end

      context "for a logical volume config" do
        let(:logical_volumes) do
          [
            {
              encryption: encryption,
              filesystem: filesystem
            }
          ]
        end

        let(:encryption) { nil }
        let(:filesystem) { nil }

        logical_volume_proc = proc { |c| c.volume_groups.first.logical_volumes.first }
        include_examples "block device", logical_volume_proc
      end

      context "for a new logical volume" do
        let(:logical_volumes) { volumes }

        logical_volumes_proc = proc { |c| c.volume_groups.first.logical_volumes }
        include_examples "new volume size", logical_volumes_proc
      end
    end
  end
end
