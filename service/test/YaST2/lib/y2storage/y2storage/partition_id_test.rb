#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017] SUSE LLC
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
require_relative "../support/shared_setup"
require "y2storage"

describe Y2Storage::PartitionId do
  include_context "yast2-storage-ng test setup"

  describe ".linux_system_ids" do
    it "returns an array of ids" do
      expect(described_class.linux_system_ids).to be_a Array
      expect(described_class.linux_system_ids).to all(be_a(Y2Storage::PartitionId))
    end

    it "does not allow to alter the original list" do
      size = described_class.linux_system_ids.size
      ids = described_class.linux_system_ids
      ids << Y2Storage::PartitionId::NTFS

      expect(ids.size).to eq(size + 1)
      expect(described_class.linux_system_ids.size).to eq size
    end
  end

  describe ".windows_system_ids" do
    it "returns an array of ids" do
      expect(described_class.windows_system_ids).to be_a Array
      expect(described_class.windows_system_ids).to all(be_a(Y2Storage::PartitionId))
    end

    it "does not allow to alter the original list" do
      size = described_class.windows_system_ids.size
      ids = described_class.windows_system_ids
      ids << Y2Storage::PartitionId::LINUX

      expect(ids.size).to eq(size + 1)
      expect(described_class.windows_system_ids.size).to eq size
    end
  end

  describe ".new_from_legacy" do
    context "when the numeric id is different from the one used in old libstorage" do
      it "returns an PartitionId corresponding to the new number" do
        expect(described_class.new_from_legacy(5)).to eq(Y2Storage::PartitionId::EXTENDED)
      end
    end

    context "when the numeric id is still the same than the one used in old libstorage" do
      it "returns an PartitionId corresponding to the current id" do
        expect(described_class.new_from_legacy(131)).to eq(Y2Storage::PartitionId::LINUX)
      end
    end

    context "when the id is not known" do
      it "returns PartitionID::UKNOWN" do
        expect(described_class.new_from_legacy(8192)).to eq(Y2Storage::PartitionId::UNKNOWN)
      end
    end
  end

  describe "#to_i_legacy" do
    subject(:partition_id) { described_class.new_from_legacy(numeric_id) }

    context "when the numeric id is different from the one used in old libstorage" do
      let(:numeric_id) { 264 }

      it "returns the numeric id used in old libstorage" do
        expect(partition_id.to_i_legacy).to eq(Y2Storage::PartitionId::PREP.to_i)
      end
    end

    context "when the numeric id is still the same than the one used in libstorage-ng" do
      let(:numeric_id) { 131 }

      it "returns the same numeric id" do
        expect(partition_id.to_i_legacy).to eq(numeric_id)
      end
    end
  end

  describe "#formattable?" do
    it "returns true if partition can be formatted" do
      expect(Y2Storage::PartitionId::NTFS.formattable?).to eq true
    end

    it "returns false otherwise" do
      expect(Y2Storage::PartitionId::PREP.formattable?).to eq true
    end
  end

  describe "#to_human_string" do
    context "when the partition id is known" do
      let(:ids) { Y2Storage::PartitionId.all - [Y2Storage::PartitionId::UNKNOWN] }

      it "returns the partition id name" do
        ids.each do |id|
          expect(id.to_human_string).to eq(Storage.partition_id_name(id.to_i))
        end
      end
    end

    context "when the partition id is unknown" do
      it "returns the id formatted as an hexadecimal number" do
        id = Y2Storage::PartitionId.new(9999)

        expect(id.to_human_string).to eq("0x270f")
      end
    end
  end

  describe "#sort_order" do
    it "sorts Linux Native before Linux Swap" do
      linux = Y2Storage::PartitionId::LINUX
      swap = Y2Storage::PartitionId::SWAP
      expect(linux.sort_order).to be < swap.sort_order
    end

    it "sorts Linux partition IDs naturally" do
      unsorted = [
        Y2Storage::PartitionId::RAID,
        Y2Storage::PartitionId::SWAP,
        Y2Storage::PartitionId::LVM,
        Y2Storage::PartitionId::LINUX
      ]

      sorted = [
        Y2Storage::PartitionId::LINUX,
        Y2Storage::PartitionId::SWAP,
        Y2Storage::PartitionId::LVM,
        Y2Storage::PartitionId::RAID
      ]

      expect(unsorted.sort).to eq sorted
    end

    it "sorts misc partition IDs naturally" do
      unsorted = [
        Y2Storage::PartitionId::NTFS,
        Y2Storage::PartitionId::BIOS_BOOT,
        Y2Storage::PartitionId::ESP,
        Y2Storage::PartitionId::SWAP,
        Y2Storage::PartitionId::LINUX
      ]

      sorted = [
        Y2Storage::PartitionId::LINUX,
        Y2Storage::PartitionId::SWAP,
        Y2Storage::PartitionId::ESP,
        Y2Storage::PartitionId::BIOS_BOOT,
        Y2Storage::PartitionId::NTFS
      ]

      expect(unsorted.sort).to eq sorted
    end

    it "sorts unknown IDs to the end of the list" do
      unsorted = [
        Y2Storage::PartitionId::NTFS,
        4242,
        Y2Storage::PartitionId::SWAP,
        Y2Storage::PartitionId::LINUX
      ]

      sorted = [
        Y2Storage::PartitionId::LINUX,
        Y2Storage::PartitionId::SWAP,
        Y2Storage::PartitionId::NTFS,
        4242
      ]

      expect(unsorted.sort).to eq sorted
    end
  end
end
