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

describe Y2Storage::PartitionTables::Base do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  before { fake_scenario(scenario) }

  let(:scenario) { "mixed_disks" }

  # Testing this because it's a nice example of usage of the Ruby wrapper
  # and because it was broken at some point
  describe "#inspect" do
    subject(:ptable) { Y2Storage::Disk.find_by_name(fake_devicegraph, "/dev/sdb").partition_table }

    it "includes the partition table type" do
      expect(ptable.inspect).to include "Msdos"
    end

    it "includes all the partitions" do
      expect(ptable.inspect).to include "Partition /dev/sdb1 4 GiB"
      expect(ptable.inspect).to include "Partition /dev/sdb2 60 GiB"
      expect(ptable.inspect).to include "Partition /dev/sdb3 60 GiB"
      expect(ptable.inspect).to include "Partition /dev/sdb4 810 GiB"
      expect(ptable.inspect).to include "Partition /dev/sdb5 300 GiB"
      expect(ptable.inspect).to include "Partition /dev/sdb6 500 GiB"
      expect(ptable.inspect).to include "Partition /dev/sdb7 10237 MiB"
    end
  end

  describe "#delete_all_partitions" do
    subject(:ptable) { Y2Storage::Disk.find_by_name(fake_devicegraph, "/dev/sdb").partition_table }

    it "deletes all partitions in table" do
      # NOTE: it is important here to have partition table with logical partitions
      # as it need special handling, so test will cover it
      ptable.delete_all_partitions
      expect(ptable.partitions).to be_empty
    end
  end

  # This test ensures the behavior of libstorage is stable in the future, because, in order
  # to generate aligned partitions, the proposal code heavily relies on the fact that
  # Y2Storage::PartitionTable#unused_partition_slots returns start aligned regions.
  describe "#unused_partition_slots" do
    let(:scenario) { "alignment" }

    let(:sda) { Y2Storage::Disk.find_by_name(fake_devicegraph, "/dev/sda") }
    let(:sdb) { Y2Storage::Disk.find_by_name(fake_devicegraph, "/dev/sdb") }
    let(:sdc) { Y2Storage::Disk.find_by_name(fake_devicegraph, "/dev/sdc") }

    let(:sda_slot) { sda.partition_table.unused_partition_slots.first }
    let(:sdb_slot) { sdb.partition_table.unused_partition_slots.first }
    let(:sdc_slot) { sdc.partition_table.unused_partition_slots.first }

    it "always returns start aligned slots" do
      expect(sda_slot.region.start).to eq(4096)
      expect(sdb_slot.region.start).to eq(4096)
      expect(sdc_slot.region.start).to eq(4096)
    end

    it "returns all space till end" do
      gpt_reserved_blocks = 16.5.KiB.to_i / sda.region.block_size.to_i

      expect(sda_slot.region.end).to eq(sda.region.end - gpt_reserved_blocks)
      expect(sdc_slot.region.end).to eq(sdc.region.end)
    end
  end

  describe "#unused_slot_for" do
    let(:scenario) { "spaces_5_3" }

    subject(:ptable) { sda.partition_table }

    let(:sda) { Y2Storage::Disk.find_by_name(fake_devicegraph, "/dev/sda") }

    let(:unused_slots) { ptable.unused_partition_slots }
    let(:unused_slot1) { unused_slots.first }
    let(:unused_slot2) { unused_slots.last }

    let(:region) { Y2Storage::Region.create(region_start, region_length, sda.region.block_size) }

    context "when the region is inside of an unused slot" do
      context "and fills all the slot" do
        let(:region_start) { unused_slot1.region.start }
        let(:region_length) { unused_slot1.region.length }

        it "returns the correct slot" do
          slot = ptable.unused_slot_for(region)

          expect(slot).to be_a(Y2Storage::PartitionTables::PartitionSlot)
          expect(slot.region.start).to eq(unused_slot1.region.start)
          expect(slot.region.end).to eq(unused_slot1.region.end)
        end
      end

      context "and does not fill all the slot" do
        let(:region_start) { unused_slot2.region.start + 10 }
        let(:region_length) { 20 }

        it "returns the correct slot" do
          slot = ptable.unused_slot_for(region)

          expect(slot).to be_a(Y2Storage::PartitionTables::PartitionSlot)
          expect(slot.region.start).to eq(unused_slot2.region.start)
          expect(slot.region.end).to eq(unused_slot2.region.end)
        end
      end
    end

    context "when the region is not inside of an unused slot" do
      let(:region_start) { unused_slot1.region.start - 10 }
      let(:region_length) { 9 }

      it "returns nil" do
        slot = ptable.unused_slot_for(region)
        expect(slot).to be_nil
      end
    end
  end

  describe "#free_spaces" do
    subject { device.partition_table }

    let(:device) { fake_devicegraph.find_by_name(device_name) }

    context "if there are no unused slots" do
      let(:scenario) { "trivial_lvm" }

      let(:device_name) { "/dev/sda" }

      it "returns an empty list" do
        expect(subject.free_spaces).to be_empty
      end
    end

    context "if there are unused slots" do
      let(:scenario) { "spaces_5_3" }

      let(:device_name) { "/dev/sda" }

      it "returns a free space for each unused slot" do
        expect(subject.free_spaces).to_not be_empty

        free_spaces_regions = subject.free_spaces.map(&:region)
        unused_slots_regions = subject.unused_partition_slots.map(&:region)

        expect(free_spaces_regions).to contain_exactly(*unused_slots_regions)
      end
    end
  end

  describe "#delete_partition" do
    let(:scenario) { "logical_encrypted" }
    let(:sda5) { fake_devicegraph.find_by_name("/dev/sda5") }
    subject(:ptable) { fake_devicegraph.find_by_name("/dev/sda").partition_table }

    before do
      sda7 = fake_devicegraph.find_by_name("/dev/sda7")
      sda7.encrypt

      sda8 = fake_devicegraph.find_by_name("/dev/sda8")
      sda8.encrypt(dm_name: "cr_sda8")
    end

    it "refreshes the auto-generated names of Encryption devices" do
      sda7 = fake_devicegraph.find_by_name("/dev/sda7")
      expect(sda7.encryption.name).to eq "/dev/mapper/cr_sda7"

      ptable.delete_partition(sda5)

      expect(sda7.name).to eq "/dev/sda6"
      expect(sda7.encryption.name).to eq "/dev/mapper/cr_sda6_2"
    end

    it "does not refresh the names of pre-existing Encryption devices" do
      sda6 = fake_devicegraph.find_by_name("/dev/sda6")

      ptable.delete_partition(sda5)

      expect(sda6.name).to eq "/dev/sda5"
      expect(sda6.encryption.name).to eq "/dev/mapper/cr_sda6"
    end

    it "does not refresh names set explicitly for Encryption devices" do
      sda8 = fake_devicegraph.find_by_name("/dev/sda8")

      ptable.delete_partition(sda5)

      expect(sda8.name).to eq "/dev/sda7"
      expect(sda8.encryption.name).to eq "/dev/mapper/cr_sda8"
    end
  end
end
