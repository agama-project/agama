#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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
require_relative "../../YaST2/lib/y2storage/support/shared_setup"
require "y2storage"
require "y2storage/proposal/discoverable_encryption_name"

describe Y2Storage::Proposal::DiscoverableEncryptionName do
  include_context "yast2-storage-ng test setup"

  subject { described_class.new(arch) }

  let(:arch) do
    double("Yast::Arch", x86_64: true, i386: false, aarch64: false, arm: false, ppc32: false,
      ppc64: false, riscv64: false, s390_32: false, s390_64: false)
  end

  let(:scenario) { "empty_hard_disk_gpt_50GiB" }

  let(:ids) { Y2Storage::PartitionId }

  before do
    fake_scenario(scenario)
  end

  let(:disk) { fake_devicegraph.find_by_name("/dev/sda") }

  # Creates a small partition in the first free slot
  #
  # @return [Y2Storage::Partition]
  def create_partition
    disk.ensure_partition_table
    slot = disk.partition_table.unused_partition_slots.first
    region = slot.region.dup
    region.length = 1024 * 1024 * 1024 / region.block_size.to_i
    disk.partition_table.create_partition(slot.name, region, Y2Storage::PartitionType::PRIMARY)
  end

  # Creates an encrypted partition with the given id, formatted and mounted at the given path
  #
  # @return [Y2Storage::Encryption]
  def encrypted_partition(id, path)
    partition = create_partition
    partition.id = id
    encryption = partition.encrypt(method: Y2Storage::EncryptionMethod::LUKS2, password: "12345")
    return encryption unless path

    encryption.create_filesystem(Y2Storage::Filesystems::Type::EXT4).create_mount_point(path)
    encryption
  end

  describe "#for" do
    {
      "/"        => [:LINUX_ROOT_X86_64, "root"],
      "/usr"     => [:LINUX_USR_X86_64, "usr"],
      "/home"    => [:LINUX_HOME, "home"],
      "/srv"     => [:LINUX_SERVER_DATA, "srv"],
      "/var"     => [:LINUX_VAR, "var"],
      "/var/tmp" => [:LINUX_VAR_TMP, "tmp"],
      "swap"     => [:SWAP, "swap"]
    }.each do |path, (id, name)|
      context "for an encrypted partition mounted at #{path} with the DPS id" do
        let(:encryption) { encrypted_partition(ids.const_get(id), path) }

        it "returns '#{name}'" do
          expect(subject.for(encryption)).to eq(name)
        end

        it "does not modify the encryption" do
          current_name = encryption.dm_table_name

          subject.for(encryption)

          expect(encryption.dm_table_name).to eq(current_name)
        end
      end
    end

    context "for an encrypted partition without the DPS id" do
      it "returns nil if the id is linux" do
        encryption = encrypted_partition(ids::LINUX, "/home")

        expect(subject.for(encryption)).to be_nil
      end

      it "returns nil if the id is the DPS id of another mount point" do
        encryption = encrypted_partition(ids::LINUX_HOME, "/srv")

        expect(subject.for(encryption)).to be_nil
      end

      it "returns nil for a swap partition with linux id" do
        encryption = encrypted_partition(ids::LINUX, "swap")

        expect(subject.for(encryption)).to be_nil
      end
    end

    context "for an encrypted partition in a MBR partition table" do
      let(:scenario) { "empty_hard_disk_mbr_50GiB" }

      it "returns nil for a partition mounted at /home" do
        encryption = encrypted_partition(ids::LINUX, "/home")

        expect(subject.for(encryption)).to be_nil
      end

      it "returns nil for a swap partition" do
        encryption = encrypted_partition(ids::SWAP, "swap")

        expect(subject.for(encryption)).to be_nil
      end
    end

    context "for an encrypted partition mounted at a path without DPS name" do
      ["/tmp", "/opt", "/boot"].each do |path|
        it "returns nil for #{path}" do
          encryption = encrypted_partition(ids::LINUX, path)

          expect(subject.for(encryption)).to be_nil
        end
      end
    end

    context "for an encrypted partition without mount point" do
      it "returns nil" do
        encryption = encrypted_partition(ids::LVM, nil)

        expect(subject.for(encryption)).to be_nil
      end
    end

    context "for an encrypted logical volume" do
      let(:scenario) { "lvm-two-vgs" }

      it "returns nil" do
        lv = fake_devicegraph.lvm_lvs.first
        lv.remove_descendants
        encryption = lv.encrypt(method: Y2Storage::EncryptionMethod::LUKS2, password: "12345")
        encryption.create_filesystem(Y2Storage::Filesystems::Type::EXT4).create_mount_point("/home")

        expect(subject.for(encryption)).to be_nil
      end
    end

    context "when the name is already used by another device" do
      let(:other) { encrypted_partition(ids::LINUX, nil) }

      before { other.dm_table_name = "home" }

      it "returns nil" do
        encryption = encrypted_partition(ids::LINUX_HOME, "/home")

        expect(subject.for(encryption)).to be_nil
      end
    end

    context "for the current architecture" do
      let(:arch) do
        double("Yast::Arch", x86_64: false, i386: false, aarch64: true, arm: false, ppc32: false,
          ppc64: false, riscv64: false, s390_32: false, s390_64: false)
      end

      it "uses the root id of the architecture" do
        encryption = encrypted_partition(ids::LINUX_ROOT_AARCH64, "/")

        expect(subject.for(encryption)).to eq("root")
      end

      it "returns nil if the partition has the root id of another architecture" do
        encryption = encrypted_partition(ids::LINUX_ROOT_X86_64, "/")

        expect(subject.for(encryption)).to be_nil
      end
    end
  end
end
