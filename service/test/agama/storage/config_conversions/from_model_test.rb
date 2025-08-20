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

require_relative "../storage_helpers"
require "agama/config"
require "agama/storage/config"
require "agama/storage/config_conversions/from_model"
require "agama/storage/configs"
require "y2storage/encryption_method"
require "y2storage/filesystems/mount_by_type"
require "y2storage/filesystems/type"
require "y2storage/pbkd_function"
require "y2storage/refinements"

# TODO: this test suite requires a better organization, similar to ToJSON tests.

using Y2Storage::Refinements::SizeCasts

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
  let(:filesystem) do
    {
      reuse:     reuse,
      default:   default,
      type:      type,
      snapshots: true,
      label:     label
    }
  end

  let(:reuse) { false }
  let(:default) { false }
  let(:type) { nil }
  let(:label) { "test" }

  context "if the filesystem is default" do
    let(:default) { true }

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
        expect(filesystem.label).to eq("test")
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
        expect(filesystem.label).to eq("test")
        expect(filesystem.path).to be_nil
        expect(filesystem.mount_by).to be_nil
        expect(filesystem.mkfs_options).to be_empty
        expect(filesystem.mount_options).to be_empty
      end
    end
  end

  context "if the filesystem is not default" do
    let(:default) { false }

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
        expect(filesystem.label).to eq("test")
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
        expect(filesystem.label).to eq("test")
        expect(filesystem.path).to be_nil
        expect(filesystem.mount_by).to be_nil
        expect(filesystem.mkfs_options).to be_empty
        expect(filesystem.mount_options).to be_empty
      end
    end
  end

  context "if the filesystem specifies 'reuse'" do
    let(:reuse) { true }

    it "sets #filesystem to the expected value" do
      config = config_proc.call(subject.convert)
      filesystem = config.filesystem
      expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
      expect(filesystem.reuse?).to eq(true)
      expect(filesystem.type.default?).to eq(false)
      expect(filesystem.type.fs_type).to be_nil
      expect(filesystem.type.btrfs).to be_nil
      expect(filesystem.label).to eq("test")
      expect(filesystem.path).to be_nil
      expect(filesystem.mount_by).to be_nil
      expect(filesystem.mkfs_options).to be_empty
      expect(filesystem.mount_options).to be_empty
    end
  end

  context "if the filesystem does not specify 'type'" do
    let(:type) { nil }

    it "sets #filesystem to the expected value" do
      config = config_proc.call(subject.convert)
      filesystem = config.filesystem
      expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
      expect(filesystem.reuse?).to eq(false)
      expect(filesystem.type.default?).to eq(false)
      expect(filesystem.type.fs_type).to be_nil
      expect(filesystem.type.btrfs).to be_nil
      expect(filesystem.label).to eq("test")
      expect(filesystem.path).to be_nil
      expect(filesystem.mount_by).to be_nil
      expect(filesystem.mkfs_options).to eq([])
      expect(filesystem.mount_options).to eq([])
    end
  end

  context "if the filesystem does not specify 'label'" do
    let(:label) { nil }

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
end

shared_examples "with mountPath and filesystem" do |config_proc|
  let(:mountPath) { "/test" }

  let(:filesystem) do
    {
      default:   false,
      type:      "btrfs",
      snapshots: true,
      label:     "test"
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
    expect(filesystem.label).to eq("test")
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
    # Add mount path in order to use the partition. Otherwise the partition is omitted because it
    # is considered a keep action.
    let(:partition) { { name: name, mountPath: "/test2" } }
    include_examples "with name", partition_proc
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
      # Reused partition with some usage.
      {
        name:      "/dev/vda1",
        mountPath: "/test1",
        size:      { default: true, min: 10.GiB.to_i }
      },
      # Reused partition with some usage.
      {
        name:           "/dev/vda2",
        mountPath:      "/test2",
        resizeIfNeeded: true,
        size:           { default: false, min: 10.GiB.to_i }
      },
      # Reused partition with some usage.
      {
        name:      "/dev/vda3",
        mountPath: "/test3",
        resize:    true,
        size:      { default: false, min: 10.GiB.to_i, max: 10.GiB.to_i }
      },
      # Reused partition representing a space action (resize).
      {
        name:           "/dev/vda4",
        resizeIfNeeded: true,
        size:           { default: false, min: 10.GiB.to_i }
      },
      # Reused partition representing a space action (resize).
      {
        name:   "/dev/vda5",
        resize: true,
        size:   { default: false, min: 10.GiB.to_i, max: 10.GiB.to_i }
      },
      # Reused partition representing a space action (delete).
      {
        name:   "/dev/vda6",
        delete: true
      },
      # Reused partition representing a space action (delete).
      {
        name:           "/dev/vda7",
        deleteIfNeeded: true
      },
      # Reused partition representing a space action (keep).
      {
        name: "/dev/vda8"
      },
      # New partition.
      {},
      # New partition.
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
      expect(partitions.size).to eq(5)
      expect(partitions[0].search.name).to eq("/dev/vda1")
      expect(partitions[1].search.name).to eq("/dev/vda2")
      expect(partitions[2].search.name).to eq("/dev/vda3")
      expect(partitions[3].filesystem).to be_nil
      expect(partitions[4].filesystem.path).to eq("/")
    end
  end

  context "if space policy is 'delete'" do
    let(:spacePolicy) { "delete" }

    it "sets #partitions to the expected value" do
      config = config_proc.call(subject.convert)
      partitions = config.partitions
      expect(partitions.size).to eq(6)
      expect(partitions[0].search.name).to eq("/dev/vda1")
      expect(partitions[1].search.name).to eq("/dev/vda2")
      expect(partitions[2].search.name).to eq("/dev/vda3")
      expect(partitions[3].filesystem).to be_nil
      expect(partitions[4].filesystem.path).to eq("/")
      expect(partitions[5].search.name).to be_nil
      expect(partitions[5].search.max).to be_nil
      expect(partitions[5].delete).to eq(true)
    end
  end

  context "if space policy is 'resize'" do
    let(:spacePolicy) { "resize" }

    it "sets #partitions to the expected value" do
      config = config_proc.call(subject.convert)
      partitions = config.partitions
      expect(partitions.size).to eq(6)
      expect(partitions[0].search.name).to eq("/dev/vda1")
      expect(partitions[1].search.name).to eq("/dev/vda2")
      expect(partitions[2].search.name).to eq("/dev/vda3")
      expect(partitions[3].filesystem).to be_nil
      expect(partitions[4].filesystem.path).to eq("/")
      expect(partitions[5].search.name).to be_nil
      expect(partitions[5].search.max).to be_nil
      expect(partitions[5].size.default?).to eq(false)
      expect(partitions[5].size.min).to eq(Y2Storage::DiskSize.zero)
      expect(partitions[5].size.max).to be_nil
    end
  end

  context "if space policy is 'custom'" do
    let(:spacePolicy) { "custom" }

    it "sets #partitions to the expected value" do
      config = config_proc.call(subject.convert)
      partitions = config.partitions
      expect(partitions.size).to eq(9)
      expect(partitions[0].search.name).to eq("/dev/vda1")
      expect(partitions[1].search.name).to eq("/dev/vda2")
      expect(partitions[2].search.name).to eq("/dev/vda3")
      expect(partitions[3].filesystem).to be_nil
      expect(partitions[4].filesystem.path).to eq("/")
      expect(partitions[5].search.name).to eq("/dev/vda4")
      expect(partitions[6].search.name).to eq("/dev/vda5")
      expect(partitions[7].search.name).to eq("/dev/vda6")
      expect(partitions[8].search.name).to eq("/dev/vda7")
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
  include Agama::RSpec::StorageHelpers

  subject do
    described_class.new(model_json, product_config: product_config)
  end

  let(:product_config) do
    Agama::Config.new({ "storage" => { "space_policy" => product_space_policy } })
  end

  let(:product_space_policy) { nil }

  before do
    mock_storage(devicegraph: scenario)

    # Speed up tests by avoding real check of TPM presence.
    allow(Y2Storage::EncryptionMethod::TPM_FDE).to receive(:possible?).and_return(true)
  end

  let(:scenario) { "disks.yaml" }

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

      it "sets #volume_groups to the expected value" do
        config = subject.convert
        expect(config.volume_groups).to be_empty
      end
    end

    context "with a JSON specifying 'boot'" do
      let(:model_json) do
        {
          boot:    {
            configure: configure,
            device:    {
              default: default,
              name:    name
            }
          },
          drives:  drives,
          mdRaids: md_raids
        }
      end

      let(:default) { false }
      let(:name) { nil }
      let(:drives) { [] }
      let(:md_raids) { [] }

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
            context "and there is a drive config for the given boot device name" do
              let(:name) { "/dev/vda" }

              let(:drives) do
                [
                  { name: "/dev/vda" }
                ]
              end

              it "does not add more drives" do
                config = subject.convert
                expect(config.drives.size).to eq(1)
                expect(config.drives.first.search.name).to eq("/dev/vda")
              end

              it "sets an alias to the drive config" do
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

            context "and there is not a drive config for the given boot device name" do
              let(:name) { "/dev/vda" }

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

            context "and there is a MD RAID config for the given boot device name" do
              let(:name) { "/dev/md0" }

              let(:md_raids) do
                [
                  { name: "/dev/md0" }
                ]
              end

              it "does not add more MD RAIDs" do
                config = subject.convert
                expect(config.md_raids.size).to eq(1)
                expect(config.md_raids.first.search.name).to eq("/dev/md0")
              end

              it "sets an alias to the MD RAID config" do
                config = subject.convert
                md = config.md_raids.first
                expect(md.alias).to_not be_nil
              end

              it "sets #boot to the expected value" do
                config = subject.convert
                boot = config.boot
                md = config.md_raids.first
                expect(boot.configure?).to eq(true)
                expect(boot.device.default?).to eq(false)
                expect(boot.device.device_alias).to eq(md.alias)
              end
            end

            context "and there is not a MD RAID config for the given boot device name" do
              let(:scenario) { "md_raids.yaml" }

              let(:name) { "/dev/md0" }

              let(:md_raids) do
                [
                  { name: "/dev/md1" }
                ]
              end

              it "adds a MD RAID for the boot device" do
                config = subject.convert
                expect(config.md_raids.size).to eq(2)

                md = config.md_raids.find { |d| d.search.name == name }
                expect(md.alias).to_not be_nil
                expect(md.partitions).to be_empty
              end

              it "sets #boot to the expected value" do
                config = subject.convert
                boot = config.boot
                md = config.md_raids.find { |d| d.search.name == name }
                expect(boot.configure?).to eq(true)
                expect(boot.device.default?).to eq(false)
                expect(boot.device.device_alias).to eq(md.alias)
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
          encryption:   {
            method:   "luks1",
            password: "12345"
          },
          drives:       [
            {
              name:       "/dev/vda",
              partitions: [
                {
                  name:      "/dev/vda1",
                  mountPath: "/test"
                },
                {
                  name:       "/dev/vda2",
                  mountPath:  "/test2",
                  filesystem: { reuse: true }
                },
                {
                  size:      { default: false, min: 256.MiB.to_i },
                  mountPath: "/boot/efi"
                },
                {
                  size:      { default: false, min: 1.GiB.to_i },
                  mountPath: "/test3"
                },
                {}
              ]
            }
          ],
          mdRaids:      [
            {
              name:       "/dev/md0",
              partitions: [
                { name: "/dev/md0-p1" },
                {}
              ]
            }
          ],
          volumeGroups: [
            {
              vgName:        "system",
              targetDevices: ["/dev/vda"]
            }
          ]
        }
      end

      it "sets #encryption to the newly formatted partitions, except the boot-related ones" do
        config = subject.convert
        partitions = config.partitions
        new_partitions = partitions.reject(&:search)
        reused_partitions = partitions.select(&:search)
        mounted_partitions, reformatted_partitions = reused_partitions.partition do |part|
          part.filesystem.reuse?
        end
        new_non_boot_partitions, new_boot_partitions = new_partitions.partition do |part|
          part.filesystem&.path != "/boot/efi"
        end

        expect(new_non_boot_partitions.map { |p| p.encryption.method.id }).to all(eq(:luks1))
        expect(new_non_boot_partitions.map { |p| p.encryption.password }).to all(eq("12345"))
        expect(reformatted_partitions.map { |p| p.encryption.method.id }).to all(eq(:luks1))
        expect(reformatted_partitions.map { |p| p.encryption.password }).to all(eq("12345"))
        expect(mounted_partitions.map(&:encryption)).to all(be_nil)
        expect(new_boot_partitions.map(&:encryption)).to all(be_nil)
      end

      it "sets #encryption for the automatically created physical volumes" do
        config = subject.convert
        volume_group = config.volume_groups.first
        target_encryption = volume_group.physical_volumes_encryption

        expect(target_encryption.method.id).to eq(:luks1)
        expect(target_encryption.password).to eq("12345")
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

    context "with a JSON specifying 'mdRaids'" do
      let(:model_json) do
        { mdRaids: md_raids }
      end

      let(:md_raids) do
        [
          md_raid,
          { name: "/dev/md1" }
        ]
      end

      let(:md_raid) do
        { name: "/dev/md0" }
      end

      context "with an empty list" do
        let(:md_raids) { [] }

        it "sets #md_raids to the expected value" do
          config = subject.convert
          expect(config.md_raids).to eq([])
        end
      end

      context "with a list of MD RAIDs" do
        it "sets #md_raids to the expected value" do
          config = subject.convert
          expect(config.md_raids.size).to eq(2)
          expect(config.md_raids).to all(be_a(Agama::Storage::Configs::MdRaid))

          md1, md2 = config.md_raids
          expect(md1.search.name).to eq("/dev/md0")
          expect(md1.partitions).to eq([])
          expect(md2.search.name).to eq("/dev/md1")
          expect(md2.partitions).to eq([])
        end
      end

      md_raid_proc = proc { |c| c.md_raids.first }

      context "if a MD RAID does not specify 'name'" do
        let(:md_raid) { {} }

        it "sets #search to the expected value" do
          md = md_raid_proc.call(subject.convert)
          expect(md.search).to be_nil
        end
      end

      context "if a MD RAID does not spicify neither 'mountPath' nor 'filesystem'" do
        let(:md_raid) { {} }
        include_examples "without filesystem", md_raid_proc
      end

      context "if a MD RAID does not spicify 'ptableType'" do
        let(:md_raid) { {} }
        include_examples "without ptableType", md_raid_proc
      end

      context "if a MD RAID does not specifies 'spacePolicy'" do
        let(:md_raid) { {} }
        include_examples "without spacePolicy", md_raid_proc
      end

      context "if a MD RAID specifies 'name'" do
        let(:md_raid) { { name: name } }
        include_examples "with name", md_raid_proc
      end

      context "if a MD RAID specifies 'mountPath'" do
        let(:md_raid) { { mountPath: mountPath } }
        include_examples "with mountPath", md_raid_proc
      end

      context "if a MD RAID specifies 'filesystem'" do
        let(:md_raid) { { filesystem: filesystem } }
        include_examples "with filesystem", md_raid_proc
      end

      context "if a MD RAID specifies both 'mountPath' and 'filesystem'" do
        let(:md_raid) { { mountPath: mountPath, filesystem: filesystem } }
        include_examples "with mountPath and filesystem", md_raid_proc
      end

      context "if a MD RAID specifies 'ptableType'" do
        let(:md_raid) { { ptableType: ptableType } }
        include_examples "with ptableType", md_raid_proc
      end

      context "if a MD RAID specifies 'partitions'" do
        let(:md_raid) { { partitions: partitions } }
        include_examples "with partitions", md_raid_proc
      end

      context "if a MD RAID specifies 'spacePolicy'" do
        let(:md_raid) { { spacePolicy: spacePolicy } }
        include_examples "with spacePolicy", md_raid_proc
      end

      context "if a MD RAID specifies both 'spacePolicy' and 'partitions'" do
        let(:md_raid) { { spacePolicy: spacePolicy, partitions: partitions } }
        include_examples "with spacePolicy and partitions", md_raid_proc
      end
    end

    context "with a JSON specifying 'volumeGroups'" do
      let(:model_json) do
        {
          drives:       drives,
          mdRaids:      md_raids,
          volumeGroups: volume_groups
        }
      end

      let(:drives) { [] }
      let(:md_raids) { [] }

      let(:volume_groups) do
        [
          volume_group,
          { vgName: "vg2" }
        ]
      end

      let(:volume_group) do
        { vgName: "vg1" }
      end

      context "with an empty list" do
        let(:volume_groups) { [] }

        it "sets #volume_groups to the expected value" do
          config = subject.convert
          expect(config.volume_groups).to eq([])
        end
      end

      context "with a list of volume groups" do
        it "sets #volume_groups to the expected value" do
          config = subject.convert
          expect(config.volume_groups.size).to eq(2)
          expect(config.volume_groups).to all(be_a(Agama::Storage::Configs::VolumeGroup))

          vg1, vg2 = config.volume_groups
          expect(vg1.name).to eq("vg1")
          expect(vg1.logical_volumes).to eq([])
          expect(vg2.name).to eq("vg2")
          expect(vg2.logical_volumes).to eq([])
        end
      end

      volume_group_proc = proc { |c| c.volume_groups.first }

      context "if a volume group does not specify 'vgName'" do
        let(:volume_group) { {} }

        it "does not set #name" do
          volume_group = volume_group_proc.call(subject.convert)
          expect(volume_group.name).to be_nil
        end
      end

      context "if a volume group does not specify 'extentSize'" do
        let(:volume_group) { {} }

        it "does not set #extent_size" do
          volume_group = volume_group_proc.call(subject.convert)
          expect(volume_group.extent_size).to be_nil
        end
      end

      context "if a volume group does not specify 'targetDevices'" do
        let(:volume_group) { {} }

        it "sets #physical_volumes_devices to the expected value" do
          volume_group = volume_group_proc.call(subject.convert)
          expect(volume_group.physical_volumes_devices).to eq([])
        end
      end

      context "if a volume group does not specify 'logicalVolumes'" do
        let(:volume_group) { {} }

        it "sets #logical_volumes to the expected value" do
          volume_group = volume_group_proc.call(subject.convert)
          expect(volume_group.logical_volumes).to eq([])
        end
      end

      context "if a volume group specifies 'vgName'" do
        let(:volume_group) { { vgName: "vg1" } }

        it "sets #name to the expected value" do
          volume_group = volume_group_proc.call(subject.convert)
          expect(volume_group.name).to eq("vg1")
        end
      end

      context "if a volume group specifies 'extentSize'" do
        let(:volume_group) { { extentSize: 1.KiB.to_i } }

        it "sets #extent_size to the expected value" do
          volume_group = volume_group_proc.call(subject.convert)
          expect(volume_group.extent_size).to eq(1.KiB)
        end
      end

      context "if a volume group specifies 'targetDevices'" do
        let(:scenario) { "md_raids.yaml" }

        let(:volume_group) { { targetDevices: ["/dev/vda", "/dev/vdb", "/dev/md0"] } }

        let(:drives) do
          [
            { name: "/dev/vda" },
            { name: "/dev/vdc" }
          ]
        end

        let(:md_raids) do
          [
            { name: "/dev/md1" }
          ]
        end

        it "adds the missing drives" do
          config = subject.convert
          expect(config.drives.size).to eq(3)
          expect(config.drives).to all(be_a(Agama::Storage::Configs::Drive))
          expect(config.drives).to include(an_object_having_attributes({ device_name: "/dev/vdb" }))
        end

        it "adds the missing MD RAIDs" do
          config = subject.convert
          expect(config.md_raids.size).to eq(2)
          expect(config.md_raids).to all(be_a(Agama::Storage::Configs::MdRaid))
          expect(config.md_raids)
            .to include(an_object_having_attributes({ device_name: "/dev/md0" }))
        end

        it "sets an alias to the target devices" do
          config = subject.convert
          vda = config.drives.find { |d| d.device_name == "/dev/vda" }
          vdb = config.drives.find { |d| d.device_name == "/dev/vdb" }
          vdc = config.drives.find { |d| d.device_name == "/dev/vdc" }
          md0 = config.md_raids.find { |d| d.device_name == "/dev/md0" }
          md1 = config.md_raids.find { |d| d.device_name == "/dev/md1" }
          expect(vda.alias).to_not be_nil
          expect(vdb.alias).to_not be_nil
          expect(vdc.alias).to be_nil
          expect(md0.alias).to_not be_nil
          expect(md1.alias).to be_nil
        end

        it "sets #physical_volumes_devices to the expected value" do
          config = subject.convert
          volume_group = volume_group_proc.call(config)
          vda = config.drives.find { |d| d.device_name == "/dev/vda" }
          vdb = config.drives.find { |d| d.device_name == "/dev/vdb" }
          md0 = config.md_raids.find { |d| d.device_name == "/dev/md0" }
          expect(volume_group.physical_volumes_devices).to eq([vda.alias, vdb.alias, md0.alias])
        end
      end

      context "if a volume group specifies 'logicalVolumes'" do
        let(:volume_group) { { logicalVolumes: logical_volumes } }

        let(:logical_volumes) do
          [
            logical_volume,
            { lvName: "lv2" }
          ]
        end

        let(:logical_volume) { { lvName: "lv1" } }

        context "with an empty list" do
          let(:logical_volumes) { [] }

          it "sets #logical_volumes to empty" do
            config = subject.convert
            expect(config.logical_volumes).to eq([])
          end
        end

        context "with a list of logical volumes" do
          it "sets #logical_volumes to the expected value" do
            volume_group = volume_group_proc.call(subject.convert)
            expect(volume_group.logical_volumes)
              .to all(be_a(Agama::Storage::Configs::LogicalVolume))
            expect(volume_group.logical_volumes.size).to eq(2)

            lv1, lv2 = volume_group.logical_volumes
            expect(lv1.name).to eq("lv1")
            expect(lv2.name).to eq("lv2")
          end
        end

        logical_volume_proc = proc { |c| volume_group_proc.call(c).logical_volumes.first }

        context "if a logical volume does not specify 'lvName'" do
          let(:logical_volume) { {} }

          it "does not set #name" do
            logical_volume = logical_volume_proc.call(subject.convert)
            expect(logical_volume.name).to be_nil
          end
        end

        context "if a logical volume does not spicify neither 'mountPath' nor 'filesystem'" do
          let(:logical_volume) { {} }
          include_examples "without filesystem", logical_volume_proc
        end

        context "if a logical volume does not spicify 'size'" do
          let(:logical_volume) { {} }
          include_examples "without size", logical_volume_proc
        end

        context "if a logical volume does not spicify 'stripes'" do
          let(:logical_volume) { {} }

          it "does not set #stripes" do
            logical_volume = logical_volume_proc.call(subject.convert)
            expect(logical_volume.stripes).to be_nil
          end
        end

        context "if a logical volume does not spicify 'stripeSize'" do
          let(:logical_volume) { {} }

          it "does not set #stripe_size" do
            logical_volume = logical_volume_proc.call(subject.convert)
            expect(logical_volume.stripe_size).to be_nil
          end
        end

        context "if a logical volume specifies 'lvName'" do
          let(:logical_volume) { { lvName: "lv1" } }

          it "sets #name to the expected value" do
            logical_volume = logical_volume_proc.call(subject.convert)
            expect(logical_volume.name).to eq("lv1")
          end
        end

        context "if a logical volume specifies 'mountPath'" do
          let(:logical_volume) { { mountPath: mountPath } }
          include_examples "with mountPath", logical_volume_proc
        end

        context "if a logical volume specifies 'filesystem'" do
          let(:logical_volume) { { filesystem: filesystem } }
          include_examples "with filesystem", logical_volume_proc
        end

        context "if a logical volume specifies both 'mountPath' and 'filesystem'" do
          let(:logical_volume) { { mountPath: mountPath, filesystem: filesystem } }
          include_examples "with mountPath and filesystem", logical_volume_proc
        end

        context "if a logical volume spicifies 'size'" do
          let(:logical_volume) { { size: size } }
          include_examples "with size", logical_volume_proc
        end

        context "if a logical volume specifies 'stripes'" do
          let(:logical_volume) { { stripes: 4 } }

          it "sets #stripes to the expected value" do
            logical_volume = logical_volume_proc.call(subject.convert)
            expect(logical_volume.stripes).to eq(4)
          end
        end

        context "if a logical volume specifies 'stripeSize'" do
          let(:logical_volume) { { stripeSize: 2.KiB.to_i } }

          it "sets #stripeSize to the expected value" do
            logical_volume = logical_volume_proc.call(subject.convert)
            expect(logical_volume.stripe_size).to eq(2.KiB)
          end
        end
      end
    end
  end
end
