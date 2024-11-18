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
require "agama/storage/config_conversions"
require "y2storage/encryption_method"
require "y2storage/filesystems/mount_by_type"
require "y2storage/filesystems/type"
require "y2storage/pbkd_function"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

shared_examples "without search" do |config_proc|
  it "does not set #search" do
    config = config_proc.call(subject.convert)
    expect(config.search).to be_nil
  end
end

shared_examples "without alias" do |config_proc|
  it "does not set #alias" do
    config = config_proc.call(subject.convert)
    expect(config.alias).to be_nil
  end
end

shared_examples "without encryption" do |config_proc|
  it "does not set #encryption" do
    config = config_proc.call(subject.convert)
    expect(config.encryption).to be_nil
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

shared_examples "without partitions" do |config_proc|
  it "sets #partitions to the expected value" do
    config = config_proc.call(subject.convert)
    expect(config.partitions).to eq([])
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

shared_examples "with search" do |config_proc|
  context "with a device name" do
    let(:search) { "/dev/vda1" }

    it "sets #search to the expected value" do
      config = config_proc.call(subject.convert)
      expect(config.search).to be_a(Agama::Storage::Configs::Search)
      expect(config.search.name).to eq("/dev/vda1")
      expect(config.search.if_not_found).to eq(:error)
    end
  end

  context "with an asterisk" do
    let(:search) { "*" }

    it "sets #search to the expected value" do
      config = config_proc.call(subject.convert)
      expect(config.search).to be_a(Agama::Storage::Configs::Search)
      expect(config.search.name).to be_nil
      expect(config.search.if_not_found).to eq(:skip)
      expect(config.search.max).to be_nil
    end
  end

  context "with a search section" do
    let(:search) do
      {
        condition:  { name: "/dev/vda1" },
        ifNotFound: "skip"
      }
    end

    it "sets #search to the expected value" do
      config = config_proc.call(subject.convert)
      expect(config.search).to be_a(Agama::Storage::Configs::Search)
      expect(config.search.name).to eq("/dev/vda1")
      expect(config.search.if_not_found).to eq(:skip)
      expect(config.search.max).to be_nil
    end
  end

  context "with a search section including a max" do
    let(:search) do
      {
        ifNotFound: "error",
        max:        3
      }
    end

    it "sets #search to the expected value" do
      config = config_proc.call(subject.convert)
      expect(config.search).to be_a(Agama::Storage::Configs::Search)
      expect(config.search.name).to be_nil
      expect(config.search.if_not_found).to eq(:error)
      expect(config.search.max).to eq 3
    end
  end
end

shared_examples "with alias" do |config_proc|
  let(:device_alias) { "test" }

  it "sets #alias to the expected value" do
    config = config_proc.call(subject.convert)
    expect(config.alias).to eq("test")
  end
end

shared_examples "with encryption" do |config_proc|
  let(:encryption) do
    {
      luks2: {
        password:     "12345",
        keySize:      256,
        pbkdFunction: "argon2i",
        cipher:       "twofish",
        label:        "test"
      }
    }
  end

  it "sets #encryption to the expected value" do
    config = config_proc.call(subject.convert)
    encryption = config.encryption
    expect(encryption).to be_a(Agama::Storage::Configs::Encryption)
    expect(encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
    expect(encryption.password).to eq("12345")
    expect(encryption.key_size).to eq(256)
    expect(encryption.pbkd_function).to eq(Y2Storage::PbkdFunction::ARGON2I)
    expect(encryption.cipher).to eq("twofish")
    expect(encryption.label).to eq("test")
  end

  context "if 'encryption' only specifies 'password'" do
    let(:encryption) do
      {
        luks2: {
          password: "12345"
        }
      }
    end

    it "sets #encryption to the expected value" do
      config = config_proc.call(subject.convert)
      encryption = config.encryption
      expect(encryption).to be_a(Agama::Storage::Configs::Encryption)
      expect(encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
      expect(encryption.password).to eq("12345")
      expect(encryption.key_size).to be_nil
      expect(encryption.pbkd_function).to be_nil
      expect(encryption.cipher).to be_nil
      expect(encryption.label).to be_nil
    end
  end

  context "if 'encryption' is 'pervasiveLuks2'" do
    let(:encryption) do
      {
        pervasiveLuks2: {
          password: "12345"
        }
      }
    end

    it "sets #encryption to the expected value" do
      config = config_proc.call(subject.convert)
      encryption = config.encryption
      expect(encryption).to be_a(Agama::Storage::Configs::Encryption)
      expect(encryption.method).to eq(Y2Storage::EncryptionMethod::PERVASIVE_LUKS2)
      expect(encryption.password).to eq("12345")
      expect(encryption.key_size).to be_nil
      expect(encryption.pbkd_function).to be_nil
      expect(encryption.cipher).to be_nil
      expect(encryption.label).to be_nil
    end
  end

  context "if 'encryption' is 'tmpFde'" do
    let(:encryption) do
      {
        tpmFde: {
          password: "12345"
        }
      }
    end

    it "sets #encryption to the expected value" do
      config = config_proc.call(subject.convert)
      encryption = config.encryption
      expect(encryption).to be_a(Agama::Storage::Configs::Encryption)
      expect(encryption.method).to eq(Y2Storage::EncryptionMethod::TPM_FDE)
      expect(encryption.password).to eq("12345")
      expect(encryption.key_size).to be_nil
      expect(encryption.pbkd_function).to be_nil
      expect(encryption.cipher).to be_nil
      expect(encryption.label).to be_nil
    end
  end
end

shared_examples "with filesystem" do |config_proc|
  let(:filesystem) do
    {
      reuseIfPossible: true,
      type:            "xfs",
      label:           "test",
      path:            "/test",
      mountBy:         "device",
      mkfsOptions:     ["version=2"],
      mountOptions:    ["rw"]
    }
  end

  it "sets #filesystem to the expected value" do
    config = config_proc.call(subject.convert)
    filesystem = config.filesystem
    expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
    expect(filesystem.reuse?).to eq(true)
    expect(filesystem.type.default?).to eq(false)
    expect(filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::XFS)
    expect(filesystem.type.btrfs).to be_nil
    expect(filesystem.label).to eq("test")
    expect(filesystem.path).to eq("/test")
    expect(filesystem.mount_by).to eq(Y2Storage::Filesystems::MountByType::DEVICE)
    expect(filesystem.mkfs_options).to contain_exactly("version=2")
    expect(filesystem.mount_options).to contain_exactly("rw")
  end

  context "if 'filesystem' specifies a 'type' with a btrfs section" do
    let(:filesystem) do
      {
        type: {
          btrfs: {
            snapshots: true
          }
        }
      }
    end

    it "sets #filesystem to the expected value" do
      config = config_proc.call(subject.convert)
      filesystem = config.filesystem
      expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
      expect(filesystem.reuse?).to eq(false)
      expect(filesystem.type.default?).to eq(false)
      expect(filesystem.type.fs_type).to eq(Y2Storage::Filesystems::Type::BTRFS)
      expect(filesystem.type.btrfs.snapshots?).to eq(true)
      expect(filesystem.label).to be_nil
      expect(filesystem.path).to be_nil
      expect(filesystem.mount_by).to be_nil
      expect(filesystem.mkfs_options).to eq([])
      expect(filesystem.mount_options).to eq([])
    end
  end

  context "if 'filesystem' is an empty section" do
    let(:filesystem) { {} }

    it "sets #filesystem to the expected value" do
      config = config_proc.call(subject.convert)
      filesystem = config.filesystem
      expect(filesystem).to be_a(Agama::Storage::Configs::Filesystem)
      expect(filesystem.reuse?).to eq(false)
      expect(filesystem.type).to be_nil
      expect(filesystem.label).to be_nil
      expect(filesystem.path).to be_nil
      expect(filesystem.mount_by).to be_nil
      expect(filesystem.mkfs_options).to eq([])
      expect(filesystem.mount_options).to eq([])
    end
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
  context "if 'size' is a string" do
    let(:size) { "10 GiB" }

    it "sets #size to the expected value" do
      config = config_proc.call(subject.convert)
      expect(config.size.default?).to eq(false)
      expect(config.size.min).to eq(10.GiB)
      expect(config.size.max).to eq(10.GiB)
    end
  end

  context "if 'size' is a number" do
    let(:size) { 3221225472 }

    it "sets #size to the expected value" do
      config = config_proc.call(subject.convert)
      expect(config.size.default?).to eq(false)
      expect(config.size.min).to eq(3.GiB)
      expect(config.size.max).to eq(3.GiB)
    end
  end

  shared_examples "min size" do
    context "and the value is a string" do
      let(:min_size) { "10 GiB" }

      it "sets #size to the expected value" do
        config = config_proc.call(subject.convert)
        expect(config.size.default?).to eq(false)
        expect(config.size.min).to eq(10.GiB)
        expect(config.size.max).to eq(Y2Storage::DiskSize.unlimited)
      end
    end

    context "and the value is a number" do
      let(:min_size) { 3221225472 }

      it "sets #size to the expected value" do
        config = config_proc.call(subject.convert)
        expect(config.size.default?).to eq(false)
        expect(config.size.min).to eq(3.GiB)
        expect(config.size.max).to eq(Y2Storage::DiskSize.unlimited)
      end
    end

    context "and the value is 'current'" do
      let(:min_size) { "current" }

      it "sets #size to the expected value" do
        config = config_proc.call(subject.convert)
        expect(config.size.default?).to eq(false)
        expect(config.size.min).to be_nil
        expect(config.size.max).to eq(Y2Storage::DiskSize.unlimited)
      end
    end
  end

  shared_examples "min and max sizes" do
    context "and the values are strings" do
      let(:min_size) { "10 GiB" }
      let(:max_size) { "20 GiB" }

      it "sets #size to the expected value" do
        config = config_proc.call(subject.convert)
        expect(config.size.default?).to eq(false)
        expect(config.size.min).to eq(10.GiB)
        expect(config.size.max).to eq(20.GiB)
      end
    end

    context "and the values are numbers" do
      let(:min_size) { 3221225472 }
      let(:max_size) { 10737418240 }

      it "sets #size to the expected value" do
        config = config_proc.call(subject.convert)
        expect(config.size.default?).to eq(false)
        expect(config.size.min).to eq(3.GiB)
        expect(config.size.max).to eq(10.GiB)
      end
    end

    context "and the values mixes string and number" do
      let(:min_size) { 3221225472 }
      let(:max_size) { "10 Gib" }

      it "sets #size to the expected value" do
        config = config_proc.call(subject.convert)
        expect(config.size.default?).to eq(false)
        expect(config.size.min).to eq(3.GiB)
        expect(config.size.max).to eq(10.GiB)
      end
    end

    context "and the min value is 'current'" do
      let(:min_size) { "current" }
      let(:max_size) { "10 GiB" }

      it "sets #size to the expected value" do
        config = config_proc.call(subject.convert)
        expect(config.size.default?).to eq(false)
        expect(config.size.min).to be_nil
        expect(config.size.max).to eq(10.GiB)
      end
    end

    context "and the max value is 'current'" do
      let(:min_size) { "10 GiB" }
      let(:max_size) { "current" }

      it "sets #size to the expected value" do
        config = config_proc.call(subject.convert)
        expect(config.size.default?).to eq(false)
        expect(config.size.min).to eq(10.GiB)
        expect(config.size.max).to be_nil
      end
    end

    context "and both values are 'current'" do
      let(:min_size) { "current" }
      let(:max_size) { "current" }

      it "sets #size to the expected value" do
        config = config_proc.call(subject.convert)
        expect(config.size.default?).to eq(false)
        expect(config.size.min).to be_nil
        expect(config.size.max).to be_nil
      end
    end
  end

  context "if 'size' is an array" do
    context "and only contains one value" do
      let(:size) { [min_size] }
      include_examples "min size"
    end

    context "and contains two values" do
      let(:size) { [min_size, max_size] }
      include_examples "min and max sizes"
    end
  end

  context "if 'size' is a hash" do
    context "and only specifies 'min'" do
      let(:size) { { min: min_size } }
      include_examples "min size"
    end

    context "and specifies 'min' and 'max'" do
      let(:size) do
        {
          min: min_size,
          max: max_size
        }
      end

      include_examples "min and max sizes"
    end
  end
end

shared_examples "with delete" do |config_proc|
  it "sets #delete to true" do
    config = config_proc.call(subject.convert)
    expect(config.delete?).to eq(true)
  end
end

shared_examples "with deleteIfNeeded" do |config_proc|
  it "sets #delete_if_needed to true" do
    config = config_proc.call(subject.convert)
    expect(config.delete_if_needed?).to eq(true)
  end
end

shared_examples "with partitions" do |config_proc|
  let(:partitions) do
    [
      partition,
      {
        filesystem: { path: "/test" }
      }
    ]
  end

  let(:partition) do
    {
      filesystem: { path: "/" }
    }
  end

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

  context "if a partition does not spicify 'search'" do
    let(:partition) { {} }
    include_examples "without search", partition_proc
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

  context "if a partition does not spicify 'encryption'" do
    let(:partition) { {} }
    include_examples "without encryption", partition_proc
  end

  context "if a partition does not spicify 'filesystem'" do
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

  context "if a partition specifies 'search'" do
    let(:partition) { { search: search } }
    include_examples "with search", partition_proc
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

  context "if a partition spicifies 'size'" do
    let(:partition) { { size: size } }
    include_examples "with size", partition_proc
  end

  context "if a partition specifies 'encryption'" do
    let(:partition) { { encryption: encryption } }
    include_examples "with encryption", partition_proc
  end

  context "if a partition specifies 'filesystem'" do
    let(:partition) { { filesystem: filesystem } }
    include_examples "with filesystem", partition_proc
  end

  context "if a partition specifies 'delete'" do
    let(:partition) { { delete: true } }
    include_examples "with delete", partition_proc
  end

  context "if a partition specifies 'deleteIfNeeded'" do
    let(:partition) { { deleteIfNeeded: true } }
    include_examples "with deleteIfNeeded", partition_proc
  end

  context "if a partition specifies 'generate'" do
    let(:partition) { { generate: generate } }

    partitions_proc = proc { |c| config_proc.call(c).partitions }
    include_examples "with generate", partitions_proc

    context "with a generate section" do
      let(:generate) do
        {
          partitions: "default",
          encryption: {
            luks2: { password: "12345" }
          }
        }
      end

      let(:default_paths) { ["/", "swap"] }

      it "adds the expected partitions" do
        partitions = config_proc.call(subject.convert).partitions
        expect(partitions.size).to eq(3)

        root_part = partitions.find { |p| p.filesystem.path == "/" }
        swap_part = partitions.find { |p| p.filesystem.path == "swap" }
        test_part = partitions.find { |p| p.filesystem.path == "/test" }

        expect(root_part).to_not be_nil
        expect(root_part.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
        expect(root_part.encryption.password).to eq("12345")

        expect(swap_part).to_not be_nil
        expect(swap_part.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
        expect(swap_part.encryption.password).to eq("12345")

        expect(test_part).to_not be_nil
        expect(test_part.encryption).to be_nil
      end
    end
  end
end

shared_examples "with generate" do |configs_proc|
  context "with 'default' value" do
    let(:generate) { "default" }

    let(:default_paths) { ["/default1", "/default2"] }

    it "adds volumes for the default paths" do
      configs = configs_proc.call(subject.convert)

      default1 = configs.find { |c| c.filesystem.path == "/default1" }
      expect(default1).to_not be_nil
      expect(default1.encryption).to be_nil

      default2 = configs.find { |c| c.filesystem.path == "/default2" }
      expect(default2).to_not be_nil
      expect(default2.encryption).to be_nil
    end
  end

  context "with 'mandatory' value" do
    let(:generate) { "mandatory" }

    let(:mandatory_paths) { ["/mandatory1"] }

    it "adds volumes for the mandatory paths" do
      configs = configs_proc.call(subject.convert)

      mandatory1 = configs.find { |c| c.filesystem.path == "/mandatory1" }
      expect(mandatory1).to_not be_nil
      expect(mandatory1.encryption).to be_nil
    end
  end
end

describe Agama::Storage::ConfigConversions::FromJSON do
  subject do
    described_class.new(config_json, default_paths: default_paths, mandatory_paths: mandatory_paths)
  end

  let(:default_paths) { [] }

  let(:mandatory_paths) { [] }

  before do
    # Speed up tests by avoding real check of TPM presence.
    allow(Y2Storage::EncryptionMethod::TPM_FDE).to receive(:possible?).and_return(true)
  end

  describe "#convert" do
    let(:config_json) { {} }

    it "returns a storage config" do
      config = subject.convert
      expect(config).to be_a(Agama::Storage::Config)
    end

    context "with an empty JSON" do
      let(:config_json) { {} }

      it "sets #boot to the expected value" do
        config = subject.convert
        expect(config.boot).to be_a(Agama::Storage::Configs::Boot)
        expect(config.boot.configure).to eq(true)
        expect(config.boot.device).to be_nil
      end

      it "sets #drives to the expected value" do
        config = subject.convert
        expect(config.drives).to be_empty
      end

      it "sets #volume_groups to the expected value" do
        config = subject.convert
        expect(config.drives).to be_empty
        expect(config.volume_groups).to be_empty
      end
    end

    context "with a JSON specifying 'boot'" do
      let(:config_json) do
        {
          boot: {
            configure: true,
            device:    "/dev/sdb"
          }
        }
      end

      it "sets #boot to the expected value" do
        config = subject.convert
        expect(config.boot).to be_a(Agama::Storage::Configs::Boot)
        expect(config.boot.configure).to eq true
        expect(config.boot.device).to eq "/dev/sdb"
      end
    end

    context "with a JSON specifying 'drives'" do
      let(:config_json) do
        { drives: drives }
      end

      let(:drives) do
        [
          drive,
          { alias: "second-disk" }
        ]
      end

      let(:drive) do
        { alias: "first-disk" }
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
          expect(drive1.alias).to eq("first-disk")
          expect(drive1.partitions).to eq([])
          expect(drive2.alias).to eq("second-disk")
          expect(drive2.partitions).to eq([])
        end
      end

      drive_proc = proc { |c| c.drives.first }

      context "if a drive does not specify 'search'" do
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

      context "if a drive does not spicify 'encryption'" do
        let(:drive) { {} }
        include_examples "without encryption", drive_proc
      end

      context "if a drive does not spicify 'filesystem'" do
        let(:drive) { {} }
        include_examples "without filesystem", drive_proc
      end

      context "if a drive does not spicify 'ptableType'" do
        let(:drive) { {} }
        include_examples "without ptableType", drive_proc
      end

      context "if a drive does not spicify 'partitions'" do
        let(:drive) { {} }
        include_examples "without partitions", drive_proc
      end

      context "if a drive specifies 'search'" do
        let(:drive) { { search: search } }
        include_examples "with search", drive_proc
      end

      context "if a drive specifies 'alias'" do
        let(:drive) { { alias: device_alias } }
        include_examples "with alias", drive_proc
      end

      context "if a drive specifies 'encryption'" do
        let(:drive) { { encryption: encryption } }
        include_examples "with encryption", drive_proc
      end

      context "if a drive specifies 'filesystem'" do
        let(:drive) { { filesystem: filesystem } }
        include_examples "with filesystem", drive_proc
      end

      context "if a drive specifies 'ptableType'" do
        let(:drive) { { ptableType: ptableType } }
        include_examples "with ptableType", drive_proc
      end

      context "if a drive specifies 'partitions'" do
        let(:drive) { { partitions: partitions } }
        include_examples "with partitions", drive_proc
      end
    end

    context "with a JSON specifying 'volumeGroups'" do
      let(:config_json) do
        { volumeGroups: volume_groups }
      end

      let(:volume_groups) do
        [
          volume_group,
          { name: "vg2" }
        ]
      end

      let(:volume_group) { { name: "vg1" } }

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

          volume_group1, volume_group2 = config.volume_groups
          expect(volume_group1.name).to eq("vg1")
          expect(volume_group1.logical_volumes).to eq([])
          expect(volume_group2.name).to eq("vg2")
          expect(volume_group2.logical_volumes).to eq([])
        end
      end

      vg_proc = proc { |c| c.volume_groups.first }

      context "if a volume group does not spicify 'name'" do
        let(:volume_group) { {} }

        it "does not set #name" do
          vg = vg_proc.call(subject.convert)
          expect(vg.name).to be_nil
        end
      end

      context "if a volume group does not spicify 'extentSize'" do
        let(:volume_group) { {} }

        it "does not set #extent_size" do
          vg = vg_proc.call(subject.convert)
          expect(vg.extent_size).to be_nil
        end
      end

      context "if a volume group does not spicify 'physicalVolumes'" do
        let(:volume_group) { {} }

        it "sets #physical_volumes to the expected vale" do
          vg = vg_proc.call(subject.convert)
          expect(vg.physical_volumes).to eq([])
        end
      end

      context "if a volume group does not spicify 'logicalVolumes'" do
        let(:volume_group) { {} }

        it "sets #logical_volumes to the expected vale" do
          vg = vg_proc.call(subject.convert)
          expect(vg.logical_volumes).to eq([])
        end
      end

      context "if a volume group spicifies 'name'" do
        let(:volume_group) { { name: "test" } }

        it "sets #name to the expected value" do
          vg = vg_proc.call(subject.convert)
          expect(vg.name).to eq("test")
        end
      end

      context "if a volume group spicifies 'extentSize'" do
        let(:volume_group) { { extentSize: size } }

        context "if 'extentSize' is a string" do
          let(:size) { "4 KiB" }

          it "sets #extent_size to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.extent_size).to eq(4.KiB)
          end
        end

        context "if 'extentSize' is a number" do
          let(:size) { 4096 }

          it "sets #extent_size to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.extent_size).to eq(4.KiB)
          end
        end
      end

      context "if a volume group spicifies 'physicalVolumes'" do
        let(:volume_group) { { physicalVolumes: physical_volumes } }

        context "with an empty list" do
          let(:physical_volumes) { [] }

          it "sets #physical_volumes to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes).to eq([])
          end

          it "sets #physical_volumes_devices to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes_devices).to eq([])
          end

          it "sets #physical_volumes_encryption to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes_encryption).to be_nil
          end
        end

        context "with a list of aliases" do
          let(:physical_volumes) { ["pv1", "pv2"] }

          it "sets #physical_volumes to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes).to contain_exactly("pv1", "pv2")
          end

          it "sets #physical_volumes_devices to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes_devices).to eq([])
          end

          it "sets #physical_volumes_encryption to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes_encryption).to be_nil
          end
        end

        context "with a list including a physical volume with 'generate' array" do
          let(:physical_volumes) do
            [
              "pv1",
              { generate: ["disk1", "disk2"] },
              "pv2"
            ]
          end

          it "sets #physical_volumes to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes).to contain_exactly("pv1", "pv2")
          end

          it "sets #physical_volumes_devices to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes_devices).to contain_exactly("disk1", "disk2")
          end

          it "does not set #physical_volumes_encryption" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes_encryption).to be_nil
          end
        end

        context "with a list including a physical volume with 'generate' section" do
          let(:physical_volumes) do
            [
              "pv1",
              {
                generate: {
                  targetDevices: target_devices,
                  encryption:    encryption
                }
              },
              "pv2"
            ]
          end

          let(:target_devices) { nil }

          let(:encryption) { nil }

          it "sets #physical_volumes to the expected value" do
            vg = vg_proc.call(subject.convert)
            expect(vg.physical_volumes).to contain_exactly("pv1", "pv2")
          end

          context "if the physical volume does not specify 'targetDevices'" do
            let(:target_devices) { nil }

            it "sets #physical_volumes_devices to the expected value" do
              vg = vg_proc.call(subject.convert)
              expect(vg.physical_volumes_devices).to eq([])
            end
          end

          context "if the physical volume does not specify 'encryption'" do
            let(:target_devices) { nil }

            it "does not set #physical_volumes_encryption" do
              vg = vg_proc.call(subject.convert)
              expect(vg.physical_volumes_encryption).to be_nil
            end
          end

          context "if the physical volume specifies 'targetDevices'" do
            let(:target_devices) { ["disk1"] }

            it "sets #physical_volumes_devices to the expected value" do
              vg = vg_proc.call(subject.convert)
              expect(vg.physical_volumes_devices).to contain_exactly("disk1")
            end
          end

          context "if the physical volume specifies 'encryption'" do
            let(:encryption) do
              {
                luks1: { password: "12345" }
              }
            end

            it "sets #physical_volumes_encryption to the expected value" do
              vg = vg_proc.call(subject.convert)
              encryption = vg.physical_volumes_encryption
              expect(encryption).to be_a(Agama::Storage::Configs::Encryption)
              expect(encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS1)
              expect(encryption.password).to eq("12345")
              expect(encryption.pbkd_function).to be_nil
              expect(encryption.label).to be_nil
              expect(encryption.cipher).to be_nil
              expect(encryption.key_size).to be_nil
            end
          end
        end
      end

      context "if a volume group spicifies 'logicalVolumes'" do
        let(:volume_group) { { logicalVolumes: logical_volumes } }

        let(:logical_volumes) do
          [
            logical_volume,
            { name: "test" }
          ]
        end

        let(:logical_volume) { { name: "root" } }

        context "with an empty list" do
          let(:logical_volumes) { [] }

          it "sets #logical_volumes to empty" do
            vg = vg_proc.call(subject.convert)
            expect(vg.logical_volumes).to eq([])
          end
        end

        context "with a list of logical volumes" do
          it "sets #logical_volumes to the expected value" do
            vg = vg_proc.call(subject.convert)
            lvs = vg.logical_volumes
            expect(lvs.size).to eq(2)

            lv1, lv2 = lvs
            expect(lv1).to be_a(Agama::Storage::Configs::LogicalVolume)
            expect(lv1.name).to eq("root")
            expect(lv2).to be_a(Agama::Storage::Configs::LogicalVolume)
            expect(lv2.name).to eq("test")
          end
        end

        lv_proc = proc { |c| c.volume_groups.first.logical_volumes.first }

        context "if a logical volume does not specify 'name'" do
          let(:logical_volume) { {} }

          it "does not set #name" do
            lv = lv_proc.call(subject.convert)
            expect(lv.name).to be_nil
          end
        end

        context "if a logical volume does not specify 'stripes'" do
          let(:logical_volume) { {} }

          it "does not set #stripes" do
            lv = lv_proc.call(subject.convert)
            expect(lv.stripes).to be_nil
          end
        end

        context "if a logical volume does not specify 'stripeSize'" do
          let(:logical_volume) { {} }

          it "does not set #stripe_size" do
            lv = lv_proc.call(subject.convert)
            expect(lv.stripe_size).to be_nil
          end
        end

        context "if a logical volume does not specify 'pool'" do
          let(:logical_volume) { {} }

          it "sets #pool? to false" do
            lv = lv_proc.call(subject.convert)
            expect(lv.pool?).to eq(false)
          end
        end

        context "if a logical volume does not specify 'usedPool'" do
          let(:logical_volume) { {} }

          it "does not set #used_pool" do
            lv = lv_proc.call(subject.convert)
            expect(lv.used_pool).to be_nil
          end
        end

        context "if a logical volume does not specify 'alias'" do
          let(:logical_volume) { {} }
          include_examples "without alias", lv_proc
        end

        context "if a logical volume does not specify 'size'" do
          let(:logical_volume) { {} }
          include_examples "without size", lv_proc
        end

        context "if a logical volume does not specify 'encryption'" do
          let(:logical_volume) { {} }
          include_examples "without encryption", lv_proc
        end

        context "if a logical volume does not specify 'filesystem'" do
          let(:logical_volume) { {} }
          include_examples "without filesystem", lv_proc
        end

        context "if a logical volume specifies 'stripes'" do
          let(:logical_volume) { { stripes: 10 } }

          it "sets #stripes to the expected value" do
            lv = lv_proc.call(subject.convert)
            expect(lv.stripes).to eq(10)
          end
        end

        context "if a logical volume specifies 'stripeSize'" do
          let(:logical_volume) { { stripeSize: size } }

          context "if 'stripeSize' is a string" do
            let(:size) { "4 KiB" }

            it "sets #stripe_size to the expected value" do
              lv = lv_proc.call(subject.convert)
              expect(lv.stripe_size).to eq(4.KiB)
            end
          end

          context "if 'stripeSize' is a number" do
            let(:size) { 4096 }

            it "sets #stripe_size to the expected value" do
              lv = lv_proc.call(subject.convert)
              expect(lv.stripe_size).to eq(4.KiB)
            end
          end
        end

        context "if a logical volume specifies 'pool'" do
          let(:logical_volume) { { pool: true } }

          it "sets #pool? to the expected value" do
            lv = lv_proc.call(subject.convert)
            expect(lv.pool?).to eq(true)
          end
        end

        context "if a logical volume specifies 'usedPool'" do
          let(:logical_volume) { { usedPool: "pool" } }

          it "sets #used_pool to the expected value" do
            lv = lv_proc.call(subject.convert)
            expect(lv.used_pool).to eq("pool")
          end
        end

        context "if a logical volume specifies 'alias'" do
          let(:logical_volume) { { alias: device_alias } }
          include_examples "with alias", lv_proc
        end

        context "if a logical volume specifies 'size'" do
          let(:logical_volume) { { size: size } }
          include_examples "with size", lv_proc
        end

        context "if a logical volume specifies 'encryption'" do
          let(:logical_volume) { { encryption: encryption } }
          include_examples "with encryption", lv_proc
        end

        context "if a logical volume specifies 'filesystem'" do
          let(:logical_volume) { { filesystem: filesystem } }
          include_examples "with filesystem", lv_proc
        end

        context "if a logical volume specifies 'generate'" do
          let(:logical_volume) { { generate: generate } }

          logical_volumes_proc = proc { |c| c.volume_groups.first.logical_volumes }
          include_examples "with generate", logical_volumes_proc

          context "with a generate section" do
            let(:generate) do
              {
                logicalVolumes: "default",
                encryption:     {
                  luks2: { password: "12345" }
                },
                stripes:        8,
                stripeSize:     "16 KiB"
              }
            end

            let(:default_paths) { ["/", "swap"] }

            it "adds the expected logical volumes" do
              lvs = subject.convert.volume_groups.first.logical_volumes
              expect(lvs.size).to eq(3)

              root_lv = lvs.find { |v| v.filesystem.path == "/" }
              swap_lv = lvs.find { |v| v.filesystem.path == "swap" }
              test_lv = lvs.find { |v| v.name == "test" }

              expect(root_lv).to_not be_nil
              expect(root_lv.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
              expect(root_lv.encryption.password).to eq("12345")

              expect(swap_lv).to_not be_nil
              expect(swap_lv.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
              expect(swap_lv.encryption.password).to eq("12345")

              expect(test_lv).to_not be_nil
              expect(test_lv.encryption).to be_nil
            end
          end
        end
      end
    end

    context "generating partitions" do
      let(:config_json) do
        {
          drives:       drives,
          volumeGroups: volume_groups
        }
      end

      let(:drives) { [] }

      let(:volume_groups) { [] }

      let(:default_paths) { ["/", "swap", "/home"] }

      let(:mandatory_paths) { ["/", "swap"] }

      context "if the device already specifies any of the partitions" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: "default" },
                { filesystem: { path: "/home" } }
              ]
            }
          ]
        end

        it "only adds partitions for the the missing paths" do
          config = subject.convert
          partitions = config.drives.first.partitions
          expect(partitions.size).to eq(3)

          root_part = partitions.find { |p| p.filesystem.path == "/" }
          swap_part = partitions.find { |p| p.filesystem.path == "swap" }
          home_part = partitions.find { |p| p.filesystem.path == "/home" }
          expect(root_part).to_not be_nil
          expect(swap_part).to_not be_nil
          expect(home_part).to_not be_nil
        end
      end

      context "if other device already specifies any of the partitions" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: "default" }
              ]
            },
            {
              partitions: [
                { filesystem: { path: "/home" } }
              ]
            }
          ]
        end

        it "only adds partitions for the the missing paths" do
          config = subject.convert
          partitions = config.drives.first.partitions
          expect(partitions.size).to eq(2)

          root_part = partitions.find { |p| p.filesystem.path == "/" }
          swap_part = partitions.find { |p| p.filesystem.path == "swap" }
          expect(root_part).to_not be_nil
          expect(swap_part).to_not be_nil
        end
      end

      context "if a volume group already specifies any of the paths" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: "mandatory" }
              ]
            }
          ]
        end

        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { filesystem: { path: "swap" } }
              ]
            }
          ]
        end

        it "only adds partitions for the the missing paths" do
          config = subject.convert
          partitions = config.drives.first.partitions
          expect(partitions.size).to eq(1)

          root_part = partitions.find { |p| p.filesystem.path == "/" }
          expect(root_part).to_not be_nil
        end
      end

      context "if the device specifies several partitions with 'generate'" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: "mandatory" },
                { generate: "default" }
              ]
            }
          ]
        end

        it "only adds partitions for the first 'generate'" do
          config = subject.convert
          partitions = config.drives.first.partitions
          expect(partitions.size).to eq(2)

          root_part = partitions.find { |p| p.filesystem.path == "/" }
          swap_part = partitions.find { |p| p.filesystem.path == "swap" }
          expect(root_part).to_not be_nil
          expect(swap_part).to_not be_nil
        end
      end

      context "if several devices specify partitions with 'generate'" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: "mandatory" }
              ]
            },
            {
              partitions: [
                { generate: "default" }
              ]
            }
          ]
        end

        it "only adds partitions to the first device with a 'generate'" do
          config = subject.convert
          drive1, drive2 = config.drives
          expect(drive1.partitions.size).to eq(2)
          expect(drive2.partitions.size).to eq(0)
        end
      end
    end

    context "generating logical volumes" do
      let(:config_json) do
        {
          drives:       drives,
          volumeGroups: volume_groups
        }
      end

      let(:drives) { [] }

      let(:volume_groups) { [] }

      let(:default_paths) { ["/", "swap", "/home"] }

      let(:mandatory_paths) { ["/", "swap"] }

      context "if the volume group already specifies any of the logical volumes" do
        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: "default" },
                { filesystem: { path: "/home" } }
              ]
            }
          ]
        end

        it "only adds logical volumes for the the missing paths" do
          config = subject.convert
          lvs = config.volume_groups.first.logical_volumes
          expect(lvs.size).to eq(3)

          root_lv = lvs.find { |v| v.filesystem.path == "/" }
          swap_lv = lvs.find { |v| v.filesystem.path == "swap" }
          home_lv = lvs.find { |v| v.filesystem.path == "/home" }
          expect(root_lv).to_not be_nil
          expect(swap_lv).to_not be_nil
          expect(home_lv).to_not be_nil
        end
      end

      context "if other volume group already specifies any of the logical volumes" do
        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: "default" }
              ]
            },
            {
              logicalVolumes: [
                { filesystem: { path: "/home" } }
              ]
            }
          ]
        end

        it "only adds logical volumes for the the missing paths" do
          config = subject.convert
          lvs = config.volume_groups.first.logical_volumes
          expect(lvs.size).to eq(2)

          root_lv = lvs.find { |v| v.filesystem.path == "/" }
          swap_lv = lvs.find { |v| v.filesystem.path == "swap" }
          expect(root_lv).to_not be_nil
          expect(swap_lv).to_not be_nil
        end
      end

      context "if a device already specifies a partition for any of the paths" do
        let(:drives) do
          [
            {
              partitions: [
                { filesystem: { path: "swap" } }
              ]
            }
          ]
        end

        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: "mandatory" }
              ]
            }
          ]
        end

        it "only adds logical volumes for the the missing paths" do
          config = subject.convert
          lvs = config.volume_groups.first.logical_volumes
          expect(lvs.size).to eq(1)

          root_lv = lvs.find { |v| v.filesystem.path == "/" }
          expect(root_lv).to_not be_nil
        end
      end

      context "if the volume group specifies several logical volumes with 'generate'" do
        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: "mandatory" },
                { generate: "default" }
              ]
            }
          ]
        end

        it "only adds logical volumes for the first 'generate'" do
          config = subject.convert
          lvs = config.volume_groups.first.logical_volumes
          expect(lvs.size).to eq(2)

          root_lv = lvs.find { |v| v.filesystem.path == "/" }
          swap_lv = lvs.find { |v| v.filesystem.path == "swap" }
          expect(root_lv).to_not be_nil
          expect(swap_lv).to_not be_nil
        end
      end

      context "if several volume groups specify logical volumes with 'generate'" do
        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: "mandatory" }
              ]
            },
            {
              logicalVolumes: [
                { generate: "default" }
              ]
            }
          ]
        end

        it "only adds logical volumes to the first volume group with a 'generate'" do
          config = subject.convert
          vg1, vg2 = config.volume_groups
          expect(vg1.logical_volumes.size).to eq(2)
          expect(vg2.logical_volumes.size).to eq(0)
        end
      end

      context "if a drive specifies a partition with 'generate'" do
        let(:drives) do
          [
            {
              partitions: [
                { generate: "mandatory" }
              ]
            }
          ]
        end

        let(:volume_groups) do
          [
            {
              logicalVolumes: [
                { generate: "mandatory" }
              ]
            }
          ]
        end

        it "does not add logical volumes to the volume group" do
          config = subject.convert
          vg = config.volume_groups.first
          expect(vg.logical_volumes.size).to eq(0)
        end
      end
    end
  end
end
