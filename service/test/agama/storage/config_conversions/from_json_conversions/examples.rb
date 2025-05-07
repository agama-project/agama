# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require_relative "../../../../test_helper"
require "agama/storage/configs/encryption"
require "agama/storage/configs/filesystem"
require "agama/storage/configs/partition"
require "agama/storage/configs/search"
require "y2storage/encryption_method"
require "y2storage/filesystems/mount_by_type"
require "y2storage/filesystems/type"
require "y2storage/pbkd_function"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

shared_examples "without search" do
  context "if 'search' is not specified" do
    let(:search) { nil }

    it "does not set #search" do
      config = subject.convert
      expect(config.search).to be_nil
    end
  end
end

shared_examples "without alias" do
  context "if 'alias' is not specified" do
    let(:alias) { nil }

    it "does not set #alias" do
      config = subject.convert
      expect(config.alias).to be_nil
    end
  end
end

shared_examples "without encryption" do
  context "if 'encryption' is not specified" do
    let(:encryption) { nil }

    it "does not set #encryption" do
      config = subject.convert
      expect(config.encryption).to be_nil
    end
  end
end

shared_examples "without filesystem" do
  context "if 'filesystem' is not specified" do
    let(:filesystem) { nil }

    it "does not set #filesystem" do
      config = subject.convert
      expect(config.filesystem).to be_nil
    end
  end
end

shared_examples "without ptableType" do
  context "if 'ptableType' is not specified" do
    let(:ptable_type) { nil }

    it "does not set #ptable_type" do
      config = subject.convert
      expect(config.ptable_type).to be_nil
    end
  end
end

shared_examples "without partitions" do
  context "if 'partitions' is not specified" do
    let(:partitions) { nil }

    it "sets #partitions to the expected value" do
      config = subject.convert
      expect(config.partitions).to eq([])
    end
  end
end

shared_examples "without size" do
  context "if 'size' is not specified" do
    let(:size) { nil }

    it "sets #size to default size" do
      config = subject.convert
      expect(config.size.default?).to eq(true)
      expect(config.size.min).to be_nil
      expect(config.size.max).to be_nil
    end
  end
end

shared_examples "without delete" do
  context "if 'delete' is not specified" do
    let(:delete) { nil }

    it "sets #delete to false" do
      config = subject.convert
      expect(config.delete?).to eq(false)
    end
  end
end

shared_examples "without deleteIfNeeded" do
  context "if 'deleteIfNeeded' is not specified" do
    let(:delete_if_needed) { nil }

    it "sets #delete_if_needed to false" do
      config = subject.convert
      expect(config.delete_if_needed?).to eq(false)
    end
  end
end

shared_examples "with search" do
  context "if 'search' is specified" do
    context "with a device name" do
      let(:search) { "/dev/vda1" }

      it "sets #search to the expected value" do
        config = subject.convert
        expect(config.search).to be_a(Agama::Storage::Configs::Search)
        expect(config.search.name).to eq("/dev/vda1")
        expect(config.search.if_not_found).to eq(:error)
      end
    end

    context "with an asterisk" do
      let(:search) { "*" }

      it "sets #search to the expected value" do
        config = subject.convert
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
        config = subject.convert
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
        config = subject.convert
        expect(config.search).to be_a(Agama::Storage::Configs::Search)
        expect(config.search.name).to be_nil
        expect(config.search.if_not_found).to eq(:error)
        expect(config.search.max).to eq 3
      end
    end
  end
end

shared_examples "with alias" do
  context "if 'alias' is specified" do
    let(:device_alias) { "test" }

    it "sets #alias to the expected value" do
      config = subject.convert
      expect(config.alias).to eq("test")
    end
  end
end

shared_examples "with encryption" do
  context "if 'encryption' is specified" do
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
      config = subject.convert
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
        config = subject.convert
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
        config = subject.convert
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
        config = subject.convert
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
end

shared_examples "with filesystem" do
  context "if 'filesystem' is specified" do
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
      config = subject.convert
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
        config = subject.convert
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
        config = subject.convert
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
end

shared_examples "with ptableType" do
  context "if 'ptableType' is specified" do
    let(:ptable_type) { "gpt" }

    it "sets #ptable_type to the expected value" do
      config = subject.convert
      expect(config.ptable_type).to eq(Y2Storage::PartitionTables::Type::GPT)
    end
  end
end

shared_examples "with size" do
  context "if 'size' is specified" do
    context "if 'size' is a string" do
      let(:size) { "10 GiB" }

      it "sets #size to the expected value" do
        config = subject.convert
        expect(config.size.default?).to eq(false)
        expect(config.size.min).to eq(10.GiB)
        expect(config.size.max).to eq(10.GiB)
      end
    end

    context "if 'size' is a number" do
      let(:size) { 3221225472 }

      it "sets #size to the expected value" do
        config = subject.convert
        expect(config.size.default?).to eq(false)
        expect(config.size.min).to eq(3.GiB)
        expect(config.size.max).to eq(3.GiB)
      end
    end

    shared_examples "min size" do
      context "and the value is a string" do
        let(:min_size) { "10 GiB" }

        it "sets #size to the expected value" do
          config = subject.convert
          expect(config.size.default?).to eq(false)
          expect(config.size.min).to eq(10.GiB)
          expect(config.size.max).to eq(Y2Storage::DiskSize.unlimited)
        end
      end

      context "and the value is a number" do
        let(:min_size) { 3221225472 }

        it "sets #size to the expected value" do
          config = subject.convert
          expect(config.size.default?).to eq(false)
          expect(config.size.min).to eq(3.GiB)
          expect(config.size.max).to eq(Y2Storage::DiskSize.unlimited)
        end
      end

      context "and the value is 'current'" do
        let(:min_size) { "current" }

        it "sets #size to the expected value" do
          config = subject.convert
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
          config = subject.convert
          expect(config.size.default?).to eq(false)
          expect(config.size.min).to eq(10.GiB)
          expect(config.size.max).to eq(20.GiB)
        end
      end

      context "and the values are numbers" do
        let(:min_size) { 3221225472 }
        let(:max_size) { 10737418240 }

        it "sets #size to the expected value" do
          config = subject.convert
          expect(config.size.default?).to eq(false)
          expect(config.size.min).to eq(3.GiB)
          expect(config.size.max).to eq(10.GiB)
        end
      end

      context "and the values mixes string and number" do
        let(:min_size) { 3221225472 }
        let(:max_size) { "10 Gib" }

        it "sets #size to the expected value" do
          config = subject.convert
          expect(config.size.default?).to eq(false)
          expect(config.size.min).to eq(3.GiB)
          expect(config.size.max).to eq(10.GiB)
        end
      end

      context "and the min value is 'current'" do
        let(:min_size) { "current" }
        let(:max_size) { "10 GiB" }

        it "sets #size to the expected value" do
          config = subject.convert
          expect(config.size.default?).to eq(false)
          expect(config.size.min).to be_nil
          expect(config.size.max).to eq(10.GiB)
        end
      end

      context "and the max value is 'current'" do
        let(:min_size) { "10 GiB" }
        let(:max_size) { "current" }

        it "sets #size to the expected value" do
          config = subject.convert
          expect(config.size.default?).to eq(false)
          expect(config.size.min).to eq(10.GiB)
          expect(config.size.max).to be_nil
        end
      end

      context "and both values are 'current'" do
        let(:min_size) { "current" }
        let(:max_size) { "current" }

        it "sets #size to the expected value" do
          config = subject.convert
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
end

shared_examples "with delete" do
  context "if 'delete' is specified" do
    let(:delete) { true }

    it "sets #delete to true" do
      config = subject.convert
      expect(config.delete?).to eq(true)
    end
  end
end

shared_examples "with deleteIfNeeded" do
  context "if 'delete' is specified" do
    let(:delete_if_needed) { true }

    it "sets #delete_if_needed to true" do
      config = subject.convert
      expect(config.delete_if_needed?).to eq(true)
    end
  end
end

shared_examples "with partitions" do
  context "if 'partitions' is specified" do
    context "with an empty list" do
      let(:partitions) { [] }

      it "sets #partitions to empty" do
        config = subject.convert
        expect(config.partitions).to eq([])
      end
    end

    context "with a list of partitions" do
      let(:partitions) do
        [
          {
            filesystem: { path: "/" }
          },
          {
            filesystem: { path: "/test" }
          }
        ]
      end

      it "sets #partitions to the expected value" do
        config = subject.convert
        partitions = config.partitions
        expect(partitions.size).to eq(2)

        partition1, partition2 = partitions
        expect(partition1).to be_a(Agama::Storage::Configs::Partition)
        expect(partition1.filesystem.path).to eq("/")
        expect(partition2).to be_a(Agama::Storage::Configs::Partition)
        expect(partition2.filesystem.path).to eq("/test")
      end
    end
  end
end
