#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2018] SUSE LLC
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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"

require "y2storage"

describe Y2Storage::Proposal::AutoinstMdCreator do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject(:creator) { described_class.new(fake_devicegraph) }

  before do
    fake_scenario(scenario)
  end

  let(:md_level) { Y2Storage::MdLevel::RAID0 }
  let(:btrfs) { Y2Storage::Filesystems::Type::BTRFS }
  let(:scenario) { "windows-linux-free-pc" }
  let(:ptable_type) { Y2Storage::PartitionTables::Type::GPT }
  let(:planned_md0) do
    planned_md(
      name: "/dev/md0", md_level: md_level, partitions: partitions, ptable_type: ptable_type
    )
  end
  let(:devices) { ["/dev/sda1", "/dev/sda2"] }
  let(:partitions) { [root] }
  let(:root) do
    planned_partition(mount_point: "/", type: btrfs, min_size: 1.GiB, max_size: 1.GiB)
  end

  describe "#create_md" do
    it "creates a new RAID" do
      result = creator.create_md(planned_md0, devices)
      devicegraph = result.devicegraph
      expect(devicegraph.md_raids.size).to eq(1)
      new_md = devicegraph.md_raids.first
      expect(new_md.name).to eq("/dev/md0")
    end

    it "adds the given devices to the new RAID" do
      result = creator.create_md(planned_md0, devices)
      devicegraph = result.devicegraph
      new_md = devicegraph.md_raids.find { |m| m.name == "/dev/md0" }
      device_names = new_md.devices.map(&:name)
      expect(device_names.sort).to eq(devices.sort)
    end

    it "adds the partitions" do
      result = creator.create_md(planned_md0, devices)
      md = result.devicegraph.md_raids.first
      part0 = md.partitions.first
      expect(part0.mount_point.path).to eq("/")
      expect(part0.size).to eq(1.GiB)
    end

    context "when no partitions are specified" do
      let(:partitions) { [] }

      it "does not add any partition" do
        result = creator.create_md(planned_md0, devices)
        md = result.devicegraph.md_raids.first
        expect(md.partitions).to be_empty
      end
    end

    it "creates a partition table of the wanted type" do
      result = creator.create_md(planned_md0, devices)
      md = result.devicegraph.md_raids.first
      expect(md.partition_table.type).to eq(ptable_type)
    end

    context "when no partition type is specified" do
      let(:ptable_type) { nil }

      it "creates a partition table of the default type" do
        result = creator.create_md(planned_md0, devices)
        md = result.devicegraph.md_raids.first
        expect(md.partition_table.type).to eq(md.preferred_ptable_type)
      end
    end

    context "when partitions sizes are specified as percentages" do
      let(:partitions) { [root] }
      let(:root) do
        planned_partition(mount_point: "/", type: btrfs, percent_size: 50)
      end

      it "adds the partitions" do
        result = creator.create_md(planned_md0, devices)
        md = result.devicegraph.md_raids.first
        part0 = md.partitions.first
        expect(part0.size.to_i).to be_within(0.5.MiB.to_i).of((md.size / 2).to_i)
      end
    end

    context "reusing a RAID" do
      let(:scenario) { "md_raid" }
      let(:real_md) { fake_devicegraph.md_raids.first }
      let(:devices) { ["/dev/sda1", "/dev/sda2", "/dev/sda3"] }

      before do
        planned_md0.reuse_name = real_md.name
        real_md.remove_descendants
      end

      it "does not create a new RAID" do
        result = creator.create_md(planned_md0, devices)
        expect(result.devicegraph.md_raids.size).to eq(1)
      end

      it "does not add any devices" do
        result = creator.create_md(planned_md0, devices)
        updated_md = result.devicegraph.md_raids.first
        expect(updated_md.devices.map(&:name)).to_not include("/dev/sda3")
      end

      context "when there are planned partitions" do
        let(:partitions) { [root] }

        it "adds new partitions to the existing RAID" do
          result = creator.create_md(planned_md0, devices)
          md = result.devicegraph.md_raids.first
          part0 = md.partitions.first
          expect(part0.mount_point.path).to eq("/")
          expect(part0.size).to eq(1.GiB)
        end
      end

      context "when a partition type is specified" do
        let(:partitions) { [root] }
        let(:ptable_type) { Y2Storage::PartitionTables::Type::MSDOS }

        context "and a partition table already exists" do
          before do
            real_md.create_partition_table(Y2Storage::PartitionTables::Type::GPT)
          end

          it "replaces the partition table for one of the wanted type" do
            result = creator.create_md(planned_md0, devices)
            md = result.devicegraph.md_raids.first
            expect(md.partition_table.type).to eq(ptable_type)
          end
        end

        context "and the RAID contains some partitions" do
          before do
            real_md.create_partition_table(Y2Storage::PartitionTables::Type::GPT)
            region = real_md.free_spaces.first.region
            region.length = region.length / 2
            ptable = real_md.partition_table
            slot = ptable.unused_slot_for(region)
            ptable.create_partition(slot.name, region, Y2Storage::PartitionType::PRIMARY)
          end

          it "does not modify the current partition table" do
            result = creator.create_md(planned_md0, devices)
            md = result.devicegraph.md_raids.first
            expect(md.partition_table.type).to_not eq(planned_md0.ptable_type)
            expect(md.partitions.size).to eq(2)
          end
        end
      end
    end
  end
end
