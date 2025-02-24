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

require_relative "../../../test_helper"
require "agama/config"
require "agama/storage/config"
require "agama/storage/config_conversions"
require "agama/storage/configs"
require "y2storage/encryption_method"
require "y2storage/filesystems/mount_by_type"
require "y2storage/filesystems/type"
require "y2storage/pbkd_function"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

shared_examples "without alias" do |config_proc|
  it "does not set #alias" do
    config = config_proc.call(subject.convert)
    expect(config.alias).to be_nil
  end
end

shared_examples "without filesystem" do |config_proc|
  it "does not set #filesystem" do
    config = config_proc.call(subject.convert)
    expect(config.filesystem).to be_nil
  end
end

shared_examples "without ptableType" do |config_proc|
  it "does not set #ptable_type" do
    config = config_proc.call(subject.convert)
    expect(config.ptable_type).to be_nil
  end
end

shared_examples "without spacePolicy" do |config_proc|
  context "if the default space policy is 'keep'" do
    let(:product_space_policy) { "keep" }

    it "sets #partitions to the expected value" do
      config = config_proc.call(subject.convert)
      partitions = config.partitions
      expect(partitions).to be_empty
    end
  end

  context "if the default space policy is 'delete'" do
    let(:product_space_policy) { "delete" }

    it "sets #partitions to the expected value" do
      config = config_proc.call(subject.convert)
      partitions = config.partitions
      expect(partitions.size).to eq(1)

      partition = partitions.first
      expect(partition.search.name).to be_nil
      expect(partition.search.if_not_found).to eq(:skip)
      expect(partition.search.max).to be_nil
      expect(partition.delete?).to eq(true)
    end
  end

  context "if the default space policy is 'resize'" do
    let(:product_space_policy) { "resize" }

    it "sets #partitions to the expected value" do
      config = config_proc.call(subject.convert)
      partitions = config.partitions
      expect(partitions.size).to eq(1)

      partition = partitions.first
      expect(partition.search.name).to be_nil
      expect(partition.search.if_not_found).to eq(:skip)
      expect(partition.search.max).to be_nil
      expect(partition.delete?).to eq(false)
      expect(partition.size.default?).to eq(false)
      expect(partition.size.min).to eq(Y2Storage::DiskSize.zero)
      expect(partition.size.max).to be_nil
    end
  end

  context "if the default space policy is 'custom'" do
    let(:product_space_policy) { "custom" }

    it "sets #partitions to the expected value" do
      config = config_proc.call(subject.convert)
      partitions = config.partitions
      expect(partitions).to be_empty
    end
  end
end

shared_examples "without size" do |config_proc|
  it "sets #size to default size" do
    config = config_proc.call(subject.convert)
    expect(config.size.default?).to eq(true)
    expect(config.size.min).to be_nil
    expect(config.size.max).to be_nil
  end
end

shared_examples "without delete" do |config_proc|
  it "sets #delete to false" do
    config = config_proc.call(subject.convert)
    expect(config.delete?).to eq(false)
  end
end

shared_examples "without deleteIfNeeded" do |config_proc|
  it "sets #delete_if_needed to false" do
    config = config_proc.call(subject.convert)
    expect(config.delete_if_needed?).to eq(false)
  end
end

shared_examples "with name" do |config_proc|
  let(:name) { "/dev/vda" }

  it "sets #search to the expected value" do
    config = config_proc.call(subject.convert)
    expect(config.search).to be_a(Agama::Storage::Configs::Search)
    expect(config.search.name).to eq("/dev/vda")
    expect(config.search.max).to be_nil
    expect(config.search.if_not_found).to eq(:error)
  end
end

shared_examples "with alias" do |config_proc|
  let(:device_alias) { "test" }

  it "sets #alias to the expected value" do
    config = config_proc.call(subject.convert)
    expect(config.alias).to eq("test")
  end
end

shared_examples "with mountPath" do |config_proc|
  let(:mountPath) { "/test" }

  it "sets #filesystem to the expected value" do
    config = config_proc.call(subject.convert)
    filesystem = config.filesystem
    expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
    expect(filesystem.reuse?).to eq(false)
    expect(filesystem.type).to be_nil
    expect(filesystem.label).to be_nil
    expect(filesystem.path).to eq("/test")
    expect(filesystem.mount_by).to be_nil
    expect(filesystem.mkfs_options).to be_empty
    expect(filesystem.mount_options).to be_empty
  end
end

shared_examples "with filesystem" do |config_proc|
  context "if the filesystem is default" do
    let(:filesystem) do
      {
        default:   true,
        type:      type,
        snapshots: true
      }
    end

    context "and the type is 'btrfs'" do
      let(:type) { "btrfs" }

      it "sets #filesystem to the expected value" do
        config = config_proc.call(subject.convert)
        filesystem = config.filesystem
        expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
        expect(filesystem.reuse?).to eq(false)
        expect(filesystem.type.default?).to eq(true)
        expect(filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
        expect(filesystem.type.btrfs).to be_a(Agama::Storage::Configs::Btrfs)
        expect(filesystem.type.btrfs.snapshots?).to eq(true)
        expect(filesystem.label).to be_nil
        expect(filesystem.path).to be_nil
        expect(filesystem.mount_by).to be_nil
        expect(filesystem.mkfs_options).to be_empty
        expect(filesystem.mount_options).to be_empty
      end
    end

    context "and the type is not 'btrfs'" do
      let(:type) { "xfs" }

      it "sets #filesystem to the expected value" do
        config = config_proc.call(subject.convert)
        filesystem = config.filesystem
        expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
        expect(filesystem.reuse?).to eq(false)
        expect(filesystem.type.default?).to eq(true)
        expect(filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::XFS)
        expect(filesystem.type.btrfs).to be_nil
        expect(filesystem.label).to be_nil
        expect(filesystem.path).to be_nil
        expect(filesystem.mount_by).to be_nil
        expect(filesystem.mkfs_options).to be_empty
        expect(filesystem.mount_options).to be_empty
      end
    end
  end

  context "if the filesystem is not default" do
    let(:filesystem) do
      {
        default:   false,
        type:      type,
        snapshots: true
      }
    end

    context "and the type is 'btrfs'" do
      let(:type) { "btrfs" }

      it "sets #filesystem to the expected value" do
        config = config_proc.call(subject.convert)
        filesystem = config.filesystem
        expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
        expect(filesystem.reuse?).to eq(false)
        expect(filesystem.type.default?).to eq(false)
        expect(filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
        expect(filesystem.type.btrfs).to be_a(Agama::Storage::Configs::Btrfs)
        expect(filesystem.type.btrfs.snapshots?).to eq(true)
        expect(filesystem.label).to be_nil
        expect(filesystem.path).to be_nil
        expect(filesystem.mount_by).to be_nil
        expect(filesystem.mkfs_options).to be_empty
        expect(filesystem.mount_options).to be_empty
      end
    end

    context "and the type is not 'btrfs'" do
      let(:type) { "xfs" }

      it "sets #filesystem to the expected value" do
        config = config_proc.call(subject.convert)
        filesystem = config.filesystem
        expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
        expect(filesystem.reuse?).to eq(false)
        expect(filesystem.type.default?).to eq(false)
        expect(filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::XFS)
        expect(filesystem.type.btrfs).to be_nil
        expect(filesystem.label).to be_nil
        expect(filesystem.path).to be_nil
        expect(filesystem.mount_by).to be_nil
        expect(filesystem.mkfs_options).to be_empty
        expect(filesystem.mount_options).to be_empty
      end
    end
  end

  context "if the filesystem does not specify 'type'" do
    let(:filesystem) { { default: false } }

    it "sets #filesystem to the expected value" do
      config = config_proc.call(subject.convert)
      filesystem = config.filesystem
      expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
      expect(filesystem.reuse?).to eq(false)
      expect(filesystem.type.default?).to eq(false)
      expect(filesystem.type.fs_type).to be_nil
      expect(filesystem.type.btrfs).to be_nil
      expect(filesystem.label).to be_nil
      expect(filesystem.path).to be_nil
      expect(filesystem.mount_by).to be_nil
      expect(filesystem.mkfs_options).to eq([])
      expect(filesystem.mount_options).to eq([])
    end
  end

  context "if the filesystem specifies 'reuse'" do
    let(:filesystem) { { reuse: true } }

    it "sets #filesystem to the expected value" do
      config = config_proc.call(subject.convert)
      filesystem = config.filesystem
      expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
      expect(filesystem.reuse?).to eq(true)
      expect(filesystem.type.default?).to eq(true)
      expect(filesystem.type.fs_type).to be_nil
      expect(filesystem.type.btrfs).to be_nil
      expect(filesystem.label).to be_nil
      expect(filesystem.path).to be_nil
      expect(filesystem.mount_by).to be_nil
      expect(filesystem.mkfs_options).to be_empty
      expect(filesystem.mount_options).to be_empty
    end
  end
end

shared_examples "with mountPath and filesystem" do |config_proc|
  let(:mountPath) { "/test" }

  let(:filesystem) do
    {
      default:   false,
      type:      "btrfs",
      snapshots: true
    }
  end

  it "sets #filesystem to the expected value" do
    config = config_proc.call(subject.convert)
    filesystem = config.filesystem
    expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
    expect(filesystem.reuse?).to eq(false)
    expect(filesystem.type.default?).to eq(false)
    expect(filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
    expect(filesystem.type.btrfs).to be_a(Agama::Storage::Configs::Btrfs)
    expect(filesystem.type.btrfs.snapshots?).to eq(true)
    expect(filesystem.label).to be_nil
    expect(filesystem.path).to eq("/test")
    expect(filesystem.mount_by).to be_nil
    expect(filesystem.mkfs_options).to be_empty
    expect(filesystem.mount_options).to be_empty
  end
end

shared_examples "with ptableType" do |config_proc|
  let(:ptableType) { "gpt" }

  it "sets #ptable_type to the expected value" do
    config = config_proc.call(subject.convert)
    expect(config.ptable_type).to eq(Y2Storage::PartitionTables::Type::GPT)
  end
end

shared_examples "with size" do |config_proc|
  context "if the size is default" do
    let(:size) do
      {
        default: true,
        min:     1.GiB.to_i,
        max:     10.GiB.to_i
      }
    end

    it "sets #size to the expected value" do
      config = config_proc.call(subject.convert)
      size = config.size
      expect(size).to be_a(Agama::Storage::Configs::Size)
      expect(size.default?).to eq(true)
      expect(size.min).to eq(1.GiB)
      expect(size.max).to eq(10.GiB)
    end
  end

  context "if the size is not default" do
    let(:size) do
      {
        default: false,
        min:     1.GiB.to_i,
        max:     10.GiB.to_i
      }
    end

    it "sets #size to the expected value" do
      config = config_proc.call(subject.convert)
      size = config.size
      expect(size).to be_a(Agama::Storage::Configs::Size)
      expect(size.default?).to eq(false)
      expect(size.min).to eq(1.GiB)
      expect(size.max).to eq(10.GiB)
    end
  end

  context "if the size does not spicify 'max'" do
    let(:size) do
      {
        default: false,
        min:     1.GiB.to_i
      }
    end

    it "sets #size to the expected value" do
      config = config_proc.call(subject.convert)
      size = config.size
      expect(size).to be_a(Agama::Storage::Configs::Size)
      expect(size.default?).to eq(false)
      expect(size.min).to eq(1.GiB)
      expect(size.max).to eq(Y2Storage::DiskSize.unlimited)
    end
  end
end

shared_examples "with partitions" do |config_proc|
  let(:partitions) do
    [
      partition,
      { mountPath: "/test" }
    ]
  end

  let(:partition) { { mountPath: "/" } }

  context "with an empty list" do
    let(:partitions) { [] }

    it "sets #partitions to empty" do
      config = config_proc.call(subject.convert)
      expect(config.partitions).to eq([])
    end
  end

  context "with a list of partitions" do
    it "sets #partitions to the expected value" do
      config = config_proc.call(subject.convert)
      partitions = config.partitions
      expect(partitions.size).to eq(2)

      partition1, partition2 = partitions
      expect(partition1).to be_a(Agama::Storage::Configs::Partition)
      expect(partition1.filesystem.path).to eq("/")
      expect(partition2).to be_a(Agama::Storage::Configs::Partition)
      expect(partition2.filesystem.path).to eq("/test")
    end
  end

  partition_proc = proc { |c| config_proc.call(c).partitions.first }

  context "if a partition does not specify 'name'" do
    let(:partition) { {} }

    it "does not set #search" do
      partition = partition_proc.call(subject.convert)
      expect(partition.search).to be_nil
    end
  end

  context "if a partition does not spicify 'alias'" do
    let(:partition) { {} }
    include_examples "without alias", partition_proc
  end

  context "if a partition does not spicify 'id'" do
    let(:partition) { {} }

    it "does not set #id" do
      partition = partition_proc.call(subject.convert)
      expect(partition.id).to be_nil
    end
  end

  context "if a partition does not spicify 'size'" do
    let(:partition) { {} }
    include_examples "without size", partition_proc
  end

  context "if a partition does not spicify neither 'mountPath' nor 'filesystem'" do
    let(:partition) { {} }
    include_examples "without filesystem", partition_proc
  end

  context "if a partition does not spicify 'delete'" do
    let(:partition) { {} }
    include_examples "without delete", partition_proc
  end

  context "if a partition does not spicify 'deleteIfNeeded'" do
    let(:partition) { {} }
    include_examples "without deleteIfNeeded", partition_proc
  end

  context "if a partition specifies 'name'" do
    let(:partition) { { name: name } }
    include_examples "with name", partition_proc
  end

  context "if a partition specifies 'alias'" do
    let(:partition) { { alias: device_alias } }
    include_examples "with alias", partition_proc
  end

  context "if a partition spicifies 'id'" do
    let(:partition) { { id: "esp" } }

    it "sets #id to the expected value" do
      partition = partition_proc.call(subject.convert)
      expect(partition.id).to eq(Y2Storage::PartitionId::ESP)
    end
  end

  context "if a partition specifies 'mountPath'" do
    let(:partition) { { mountPath: mountPath } }
    include_examples "with mountPath", partition_proc
  end

  context "if a partition specifies 'filesystem'" do
    let(:partition) { { filesystem: filesystem } }
    include_examples "with filesystem", partition_proc
  end

  context "if a partition specifies both 'mountPath' and 'filesystem'" do
    let(:partition) { { mountPath: mountPath, filesystem: filesystem } }
    include_examples "with mountPath and filesystem", partition_proc
  end

  context "if a partition spicifies 'size'" do
    let(:partition) { { size: size } }
    include_examples "with size", partition_proc
  end
end

shared_examples "with spacePolicy" do |config_proc|
  context "if space policy is 'keep'" do
    let(:spacePolicy) { "keep" }

    it "sets #partitions to the expected value" do
      config = config_proc.call(subject.convert)
      partitions = config.partitions
      expect(partitions).to be_empty
    end
  end

  context "if space policy is 'delete'" do
    let(:spacePolicy) { "delete" }

    it "sets #partitions to the expected value" do
      config = config_proc.call(subject.convert)
      partitions = config.partitions
      expect(partitions.size).to eq(1)

      partition = partitions.first
      expect(partition.search.name).to be_nil
      expect(partition.search.if_not_found).to eq(:skip)
      expect(partition.search.max).to be_nil
      expect(partition.delete?).to eq(true)
    end
  end

  context "if space policy is 'resize'" do
    let(:spacePolicy) { "resize" }

    it "sets #partitions to the expected value" do
      config = config_proc.call(subject.convert)
      partitions = config.partitions
      expect(partitions.size).to eq(1)

      partition = partitions.first
      expect(partition.search.name).to be_nil
      expect(partition.search.if_not_found).to eq(:skip)
      expect(partition.search.max).to be_nil
      expect(partition.delete?).to eq(false)
      expect(partition.size.default?).to eq(false)
      expect(partition.size.min).to eq(Y2Storage::DiskSize.zero)
      expect(partition.size.max).to be_nil
    end
  end

  context "if space policy is 'custom'" do
    let(:spacePolicy) { "custom" }

    it "sets #partitions to the expected value" do
      config = config_proc.call(subject.convert)
      partitions = config.partitions
      expect(partitions).to be_empty
    end
  end
end

shared_examples "with spacePolicy and partitions" do |config_proc|
  let(:partitions) do
    [
      # Partition exists and it is used.
      {
        name:      "/dev/vda1",
        mountPath: "/test1",
        size:      { default: true, min: 10.GiB.to_i }
      },
      # Partition exists and it is used.
      {
        name:           "/dev/vda2",
        mountPath:      "/test2",
        resizeIfNeeded: true,
        size:           { default: false, min: 10.GiB.to_i }
      },
      # Partition exists and it is used.
      {
        name:      "/dev/vda3",
        mountPath: "/test3",
        resize:    true,
        size:      { default: false, min: 10.GiB.to_i, max: 10.GiB.to_i }
      },
      # Partition exists and it is not used (space action).
      {
        name:           "/dev/vda4",
        resizeIfNeeded: true,
        size:           { default: false, min: 10.GiB.to_i }
      },
      # Partition exists and it is not used (space action).
      {
        name:   "/dev/vda5",
        resize: true,
        size:   { default: false, min: 10.GiB.to_i, max: 10.GiB.to_i }
      },
      # Partition exists and it is not used (space action).
      {
        name:   "/dev/vda6",
        delete: true
      },
      # Partition exists and it is not used (space action).
      {
        name:           "/dev/vda7",
        deleteIfNeeded: true
      },
      # Partition does not exist.
      {
        mountPath:      "/",
        resizeIfNeeded: true,
        size:           { default: false, min: 10.GiB.to_i },
        filesystem:     { type: "btrfs" }
      }
    ]
  end

  context "if space policy is 'keep'" do
    let(:spacePolicy) { "keep" }

    it "sets #partitions to the expected value" do
      config = config_proc.call(subject.convert)
      partitions = config.partitions
      expect(partitions.size).to eq(4)
      expect(partitions[0].search.name).to eq("/dev/vda1")
      expect(partitions[1].search.name).to eq("/dev/vda2")
      expect(partitions[2].search.name).to eq("/dev/vda3")
      expect(partitions[3].filesystem.path).to eq("/")
    end
  end

  context "if space policy is 'delete'" do
    let(:spacePolicy) { "delete" }

    it "sets #partitions to the expected value" do
      config = config_proc.call(subject.convert)
      partitions = config.partitions
      expect(partitions.size).to eq(5)
      expect(partitions[0].search.name).to eq("/dev/vda1")
      expect(partitions[1].search.name).to eq("/dev/vda2")
      expect(partitions[2].search.name).to eq("/dev/vda3")
      expect(partitions[3].filesystem.path).to eq("/")
      expect(partitions[4].search.name).to be_nil
      expect(partitions[4].search.max).to be_nil
      expect(partitions[4].delete).to eq(true)
    end
  end

  context "if space policy is 'resize'" do
    let(:spacePolicy) { "resize" }

    it "sets #partitions to the expected value" do
      config = config_proc.call(subject.convert)
      partitions = config.partitions
      expect(partitions.size).to eq(5)
      expect(partitions[0].search.name).to eq("/dev/vda1")
      expect(partitions[1].search.name).to eq("/dev/vda2")
      expect(partitions[2].search.name).to eq("/dev/vda3")
      expect(partitions[3].filesystem.path).to eq("/")
      expect(partitions[4].search.name).to be_nil
      expect(partitions[4].search.max).to be_nil
      expect(partitions[4].size.default?).to eq(false)
      expect(partitions[4].size.min).to eq(Y2Storage::DiskSize.zero)
      expect(partitions[4].size.max).to be_nil
    end
  end

  context "if space policy is 'custom'" do
    let(:spacePolicy) { "custom" }

    it "sets #partitions to the expected value" do
      config = config_proc.call(subject.convert)
      partitions = config.partitions
      expect(partitions.size).to eq(8)
      expect(partitions[0].search.name).to eq("/dev/vda1")
      expect(partitions[1].search.name).to eq("/dev/vda2")
      expect(partitions[2].search.name).to eq("/dev/vda3")
      expect(partitions[3].search.name).to eq("/dev/vda4")
      expect(partitions[4].search.name).to eq("/dev/vda5")
      expect(partitions[5].search.name).to eq("/dev/vda6")
      expect(partitions[6].search.name).to eq("/dev/vda7")
      expect(partitions[7].filesystem.path).to eq("/")
    end

    context "if a partition spicifies 'resizeIfNeeded'" do
      let(:partitions) { [{ resizeIfNeeded: resizeIfNeeded }] }

      context "if 'resizeIfNeeded' is true" do
        let(:resizeIfNeeded) { true }

        it "sets #size to the expected value" do
          config = config_proc.call(subject.convert)
          size = config.partitions.first.size
          expect(size).to be_a(Agama::Storage::Configs::Size)
          expect(size.default?).to eq(false)
          expect(size.min).to eq(Y2Storage::DiskSize.zero)
          expect(size.max).to be_nil
        end
      end

      context "if 'resizeIfNeeded' is false" do
        let(:resizeIfNeeded) { false }

        it "sets #size to the expected value" do
          config = config_proc.call(subject.convert)
          size = config.partitions.first.size
          expect(size).to be_a(Agama::Storage::Configs::Size)
          expect(size.default?).to eq(true)
          expect(size.min).to be_nil
          expect(size.max).to be_nil
        end
      end
    end

    context "if a partition spicifies both 'size' and 'resizeIfNeeded'" do
      let(:partitions) { [{ size: size, resizeIfNeeded: resizeIfNeeded }] }

      let(:size) do
        {
          default: true,
          min:     1.GiB.to_i,
          max:     10.GiB.to_i
        }
      end

      context "if 'resizeIfNeeded' is true" do
        let(:resizeIfNeeded) { true }

        it "sets #size to the expected value" do
          config = config_proc.call(subject.convert)
          size = config.partitions.first.size
          expect(size).to be_a(Agama::Storage::Configs::Size)
          expect(size.default?).to eq(false)
          expect(size.min).to eq(Y2Storage::DiskSize.zero)
          expect(size.max).to be_nil
        end
      end

      context "if 'resizeIfNeeded' is false" do
        let(:resizeIfNeeded) { false }

        it "sets #size to the expected value" do
          config = config_proc.call(subject.convert)
          size = config.partitions.first.size
          expect(size).to be_a(Agama::Storage::Configs::Size)
          expect(size.default?).to eq(true)
          expect(size.min).to eq(1.GiB)
          expect(size.max).to eq(10.GiB)
        end
      end
    end

    context "if a partition spicifies both 'size' and 'resize'" do
      let(:partitions) { [{ size: size, resize: resize }] }

      let(:size) do
        {
          default: true,
          min:     1.GiB.to_i,
          max:     10.GiB.to_i
        }
      end

      context "if 'resize' is true" do
        let(:resize) { true }

        it "sets #size to the expected value" do
          config = config_proc.call(subject.convert)
          size = config.partitions.first.size
          expect(size).to be_a(Agama::Storage::Configs::Size)
          expect(size.default?).to eq(true)
          expect(size.min).to eq(1.GiB)
          expect(size.max).to eq(10.GiB)
        end
      end

      context "if 'size' is false" do
        let(:resize) { false }

        it "sets #size to the expected value" do
          config = config_proc.call(subject.convert)
          size = config.partitions.first.size
          expect(size).to be_a(Agama::Storage::Configs::Size)
          expect(size.default?).to eq(true)
          expect(size.min).to eq(1.GiB)
          expect(size.max).to eq(10.GiB)
        end
      end
    end

    context "if a partition specifies 'delete'" do
      let(:partitions) { [{ delete: true, mountPath: mount_path }] }

      let(:mount_path) { nil }

      it "sets #delete to true" do
        config = config_proc.call(subject.convert)
        partition = config.partitions.first
        expect(partition.delete?).to eq(true)
      end

      context "and the partition has a mount path" do
        let(:mount_path) { "/test" }

        it "sets #delete to false" do
          config = config_proc.call(subject.convert)
          partition = config.partitions.first
          expect(partition.delete?).to eq(false)
        end
      end
    end

    context "if a partition specifies 'deleteIfNeeded'" do
      let(:partitions) { [{ deleteIfNeeded: true, mountPath: mount_path }] }

      let(:mount_path) { nil }

      it "sets #delete_if_needed to true" do
        config = config_proc.call(subject.convert)
        partition = config.partitions.first
        expect(partition.delete_if_needed?).to eq(true)
      end

      context "and the partition has a mount path" do
        let(:mount_path) { "/test" }

        it "sets #delete_if_needed to false" do
          config = config_proc.call(subject.convert)
          partition = config.partitions.first
          expect(partition.delete_if_needed?).to eq(false)
        end
      end
    end
  end
end

describe Agama::Storage::ConfigConversions::FromModel do
  subject do
    described_class.new(model_json, product_config: product_config)
  end

  let(:product_config) do
    Agama::Config.new({ "storage" => { "space_policy" => product_space_policy } })
  end

  let(:product_space_policy) { nil }

  before do
    # Speed up tests by avoding real check of TPM presence.
    allow(Y2Storage::EncryptionMethod::TPM_FDE).to receive(:possible?).and_return(true)
  end

  describe "#convert" do
    let(:model_json) { {} }

    it "returns a storage config" do
      config = subject.convert
      expect(config).to be_a(Agama::Storage::Config)
    end

    context "with an empty JSON" do
      let(:model_json) { {} }

      it "sets #boot to the expected value" do
        config = subject.convert
        boot = config.boot
        expect(boot).to be_a(Agama::Storage::Configs::Boot)
        expect(boot.configure?).to eq(true)
        expect(boot.device).to be_a(Agama::Storage::Configs::BootDevice)
        expect(boot.device.default?).to eq(true)
        expect(boot.device.device_alias).to be_nil
      end

      it "sets #drives to the expected value" do
        config = subject.convert
        expect(config.drives).to be_empty
      end
    end

    context "with a JSON specifying 'boot'" do
      let(:model_json) do
        {
          boot:   {
            configure: configure,
            device:    {
              default: default,
              name:    name
            }
          },
          drives: drives
        }
      end

      let(:default) { false }
      let(:name) { nil }
      let(:drives) { [] }

      context "if boot is set to be configured" do
        let(:configure) { true }

        context "and the boot device is set to default" do
          let(:default) { true }
          let(:name) { "/dev/vda" }

          it "sets #boot to the expected value" do
            config = subject.convert
            boot = config.boot
            expect(boot.configure?).to eq(true)
            expect(boot.device.default?).to eq(true)
            expect(boot.device.device_alias).to be_nil
          end
        end

        context "and the boot device is not set to default" do
          let(:default) { false }

          context "and the boot device does not specify 'name'" do
            let(:name) { nil }

            it "sets #boot to the expected value" do
              config = subject.convert
              boot = config.boot
              expect(boot.configure?).to eq(true)
              expect(boot.device.default?).to eq(false)
              expect(boot.device.device_alias).to be_nil
            end
          end

          context "and the boot device specifies a 'name'" do
            let(:name) { "/dev/vda" }

            context "and there is a drive model for the given boot device name" do
              let(:drives) do
                [
                  { name: "/dev/vda", alias: device_alias }
                ]
              end

              context "and the drive model specifies an alias" do
                let(:device_alias) { "boot" }

                it "does not add more drives" do
                  config = subject.convert
                  expect(config.drives.size).to eq(1)

                  drive = config.drives.first
                  expect(drive.alias).to eq("boot")
                end

                it "sets #boot to the expected value" do
                  config = subject.convert
                  boot = config.boot
                  expect(boot.configure?).to eq(true)
                  expect(boot.device.default?).to eq(false)
                  expect(boot.device.device_alias).to eq("boot")
                end
              end

              context "and the drive model does not specify an alias" do
                let(:device_alias) { nil }

                it "does not add more drives" do
                  config = subject.convert
                  expect(config.drives.size).to eq(1)
                end

                it "sets an alias to the boot drive config" do
                  config = subject.convert
                  drive = config.drives.first
                  expect(drive.alias).to_not be_nil
                end

                it "sets #boot to the expected value" do
                  config = subject.convert
                  boot = config.boot
                  drive = config.drives.first
                  expect(boot.configure?).to eq(true)
                  expect(boot.device.default?).to eq(false)
                  expect(boot.device.device_alias).to eq(drive.alias)
                end
              end
            end

            context "and there is no drive model for the given boot device name" do
              let(:drives) do
                [
                  { name: "/dev/vdb" }
                ]
              end

              it "adds a drive for the boot device" do
                config = subject.convert
                expect(config.drives.size).to eq(2)

                drive = config.drives.find { |d| d.search.name == name }
                expect(drive.alias).to_not be_nil
                expect(drive.partitions).to be_empty
              end

              it "sets #boot to the expected value" do
                config = subject.convert
                boot = config.boot
                drive = config.drives.find { |d| d.search.name == name }
                expect(boot.configure?).to eq(true)
                expect(boot.device.default?).to eq(false)
                expect(boot.device.device_alias).to eq(drive.alias)
              end
            end
          end
        end
      end

      context "if boot is not set to be configured" do
        let(:configure) { false }
        let(:default) { true }
        let(:name) { "/dev/vda" }

        it "sets #boot to the expected value" do
          config = subject.convert
          boot = config.boot
          expect(boot.configure?).to eq(false)
          expect(boot.device.default?).to eq(true)
          expect(boot.device.device_alias).to be_nil
        end
      end
    end

    context "with a JSON specifying 'encryption'" do
      let(:model_json) do
        {
          encryption: {
            method:   "luks1",
            password: "12345"
          },
          drives:     [
            {
              name:       "/dev/vda",
              partitions: [
                { name: "/dev/vda1" },
                {}
              ]
            }
          ]
        }
      end

      it "sets #encryption to the new partitions" do
        config = subject.convert
        partitions = config.drives.first.partitions
        new_partition = partitions.find { |p| p.search.nil? }
        reused_partition = partitions.find { |p| p.search&.name == "/dev/vda1" }

        expect(new_partition.encryption.method.id).to eq(:luks1)
        expect(new_partition.encryption.password).to eq("12345")
        expect(reused_partition.encryption).to be_nil
      end
    end

    context "with a JSON specifying 'drives'" do
      let(:model_json) do
        { drives: drives }
      end

      let(:drives) do
        [
          drive,
          { name: "/dev/vdb" }
        ]
      end

      let(:drive) do
        { name: "/dev/vda" }
      end

      context "with an empty list" do
        let(:drives) { [] }

        it "sets #drives to the expected value" do
          config = subject.convert
          expect(config.drives).to eq([])
        end
      end

      context "with a list of drives" do
        it "sets #drives to the expected value" do
          config = subject.convert
          expect(config.drives.size).to eq(2)
          expect(config.drives).to all(be_a(Agama::Storage::Configs::Drive))

          drive1, drive2 = config.drives
          expect(drive1.search.name).to eq("/dev/vda")
          expect(drive1.partitions).to eq([])
          expect(drive2.search.name).to eq("/dev/vdb")
          expect(drive2.partitions).to eq([])
        end
      end

      drive_proc = proc { |c| c.drives.first }

      context "if a drive does not specify 'name'" do
        let(:drive) { {} }

        it "sets #search to the expected value" do
          drive = drive_proc.call(subject.convert)
          expect(drive.search).to be_a(Agama::Storage::Configs::Search)
          expect(drive.search.name).to be_nil
          expect(drive.search.if_not_found).to eq(:error)
        end
      end

      context "if a drive does not spicify 'alias'" do
        let(:drive) { {} }
        include_examples "without alias", drive_proc
      end

      context "if a drive does not spicify neither 'mountPath' nor 'filesystem'" do
        let(:drive) { {} }
        include_examples "without filesystem", drive_proc
      end

      context "if a drive does not spicify 'ptableType'" do
        let(:drive) { {} }
        include_examples "without ptableType", drive_proc
      end

      context "if a drive does not specifies 'spacePolicy'" do
        let(:drive) { {} }
        include_examples "without spacePolicy", drive_proc
      end

      context "if a drive specifies 'name'" do
        let(:drive) { { name: name } }
        include_examples "with name", drive_proc
      end

      context "if a drive specifies 'alias'" do
        let(:drive) { { alias: device_alias } }
        include_examples "with alias", drive_proc
      end

      context "if a drive specifies 'mountPath'" do
        let(:drive) { { mountPath: mountPath } }
        include_examples "with mountPath", drive_proc
      end

      context "if a drive specifies 'filesystem'" do
        let(:drive) { { filesystem: filesystem } }
        include_examples "with filesystem", drive_proc
      end

      context "if a drive specifies both 'mountPath' and 'filesystem'" do
        let(:drive) { { mountPath: mountPath, filesystem: filesystem } }
        include_examples "with mountPath and filesystem", drive_proc
      end

      context "if a drive specifies 'ptableType'" do
        let(:drive) { { ptableType: ptableType } }
        include_examples "with ptableType", drive_proc
      end

      context "if a drive specifies 'partitions'" do
        let(:drive) { { partitions: partitions } }
        include_examples "with partitions", drive_proc
      end

      context "if a drive specifies 'spacePolicy'" do
        let(:drive) { { spacePolicy: spacePolicy } }
        include_examples "with spacePolicy", drive_proc
      end

      context "if a drive specifies both 'spacePolicy' and 'partitions'" do
        let(:drive) { { spacePolicy: spacePolicy, partitions: partitions } }
        include_examples "with spacePolicy and partitions", drive_proc
      end
    end
  end
end
