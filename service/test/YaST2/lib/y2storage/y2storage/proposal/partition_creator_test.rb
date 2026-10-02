#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2016] SUSE LLC
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
require "storage"
require "y2storage"

describe Y2Storage::Proposal::PartitionCreator do
  include_context "yast2-storage-ng test setup"

  def partitions(devicegraph, type)
    devicegraph.partitions.select { |p| p.type.is?(type) }
  end

  describe "#create_partitions" do
    using Y2Storage::Refinements::SizeCasts

    before do
      fake_scenario(scenario)
    end

    let(:root_vol) { planned_vol(mount_point: "/", type: :ext4, min: 1.GiB) }
    let(:home_vol) { planned_vol(mount_point: "/home", type: :ext4, min: 1.GiB) }
    let(:swap_vol) { planned_vol(mount_point: "swap", type: :swap, min: 1.GiB) }
    let(:disk_spaces) { fake_devicegraph.free_spaces }

    subject(:creator) { described_class.new(fake_devicegraph) }

    let(:scenario) { "spaces_3_8_two_disks" }

    let(:distribution) do
      space3 = disk_spaces.detect { |s| s.disk_size == (3.GiB - 1.MiB) }
      space8 = disk_spaces.detect { |s| s.disk_size == (8.GiB - 1.MiB) }
      space_dist(space3 => [root_vol, home_vol], space8 => [swap_vol])
    end

    it "uses align grain to properly align partitions" do
      expect(disk_spaces.first).to receive(:align_grain).at_least(:once)

      creator.create_partitions(distribution)
    end

    it "creates the partitions honouring the distribution" do
      result = creator.create_partitions(distribution)
      devicegraph = result.devicegraph
      sda = devicegraph.disks.detect { |d| d.name == "/dev/sda" }
      sdb = devicegraph.disks.detect { |d| d.name == "/dev/sdb" }

      expect(sda.partitions).to contain_exactly(
        an_object_having_attributes(filesystem_mountpoint: "/"),
        an_object_having_attributes(filesystem_mountpoint: "/home"),
        an_object_having_attributes(filesystem_mountpoint: nil)
      )
      expect(sdb.partitions).to contain_exactly(
        an_object_having_attributes(filesystem_mountpoint: "swap"),
        an_object_having_attributes(filesystem_mountpoint: nil)
      )
    end

    it "includes a devices map in the device" do
      result = creator.create_partitions(distribution)
      devices_map = result.devices_map
      expect(devices_map["/dev/sda2"].mount_point).to eq("/")
      expect(devices_map["/dev/sda3"].mount_point).to eq("/home")
      expect(devices_map["/dev/sda2"].mount_point).to eq("/")
    end

    context "when filling a space with several partitions" do
      let(:scenario) { "empty_hard_disk_mbr_50GiB" }
      let(:distribution) do
        space_dist(disk_spaces.first => [root_vol, home_vol, swap_vol])
      end

      context "if the exact space is available" do
        before do
          root_vol.min = 20.GiB
          home_vol.min = 20.GiB
          swap_vol.min = 10.GiB - 1.MiB
        end

        it "creates partitions matching the volume sizes" do
          result = creator.create_partitions(distribution)
          expect(result.devicegraph.partitions).to contain_exactly(
            an_object_having_attributes(filesystem_mountpoint: "/", size: 20.GiB),
            an_object_having_attributes(filesystem_mountpoint: "/home", size: 20.GiB),
            an_object_having_attributes(filesystem_mountpoint: "swap", size: 10.GiB - 1.MiB)
          )
        end
      end

      context "if some extra space is available" do
        before do
          root_vol.min = 20.GiB
          root_vol.weight = 1
          home_vol.min = 20.GiB
          home_vol.weight = 2
          swap_vol.min = 1.GiB - 1.MiB
          swap_vol.max = 1.GiB - 1.MiB
          swap_vol.weight = 0
        end

        it "distributes the extra space" do
          result = creator.create_partitions(distribution)
          expect(result.devicegraph.partitions).to contain_exactly(
            an_object_having_attributes(filesystem_mountpoint: "/", size: 23.GiB),
            an_object_having_attributes(filesystem_mountpoint: "/home", size: 26.GiB),
            an_object_having_attributes(filesystem_mountpoint: "swap", size: 1.GiB - 1.MiB)
          )
        end

        context "if one of the partitions is small" do
          before do
            swap_vol.min = 256.KiB
          end

          # In the past, the adjustments introduced by alignment caused the
          # other partitions to exhaust all the usable space, so the small
          # partition couldn't be created
          it "does not exhaust the space" do
            result = creator.create_partitions(distribution)
            expect(result.devicegraph.partitions).to contain_exactly(
              an_object_having_attributes(filesystem_mountpoint: "/"),
              an_object_having_attributes(filesystem_mountpoint: "/home"),
              an_object_having_attributes(filesystem_mountpoint: "swap")
            )
          end

          it "grows the small partition until the end of the slot" do
            result = creator.create_partitions(distribution)
            partition = result.devicegraph.partitions.detect { |p| p.id.is?(:swap) }
            expect(partition.size).to eq 1.MiB
          end
        end
      end

      context "when the space is not divisible by the minimal grain" do
        # The last 16.5KiB of GPT are not usable, which makes the space not
        # divisible by 1MiB
        let(:scenario) { "empty_hard_disk_gpt_25GiB" }
        let(:vol1) { planned_vol(mount_point: "/1", type: :vfat, min: vol1_size, weight: 1) }
        let(:vol2) { planned_vol(mount_point: "/2", type: :ext4, min: 20.GiB, weight: 1) }
        let(:vol1_size) { 2.GiB }
        let(:distribution) { space_dist(disk_spaces.first => [vol1, vol2]) }

        it "fills the whole space if possible" do
          result = creator.create_partitions(distribution)
          expect(result.devicegraph.free_spaces).to be_empty
        end

        context "if it's necessary to enforce a partition order" do
          let(:vol1_size) { disk_spaces.first.disk_size - 20.GiB - 256.KiB }

          it "fills the whole space if possible" do
            result = creator.create_partitions(distribution)
            expect(result.devicegraph.free_spaces).to be_empty
          end

          it "places the required volume at the end" do
            result = creator.create_partitions(distribution)
            expect(result.devicegraph.partitions.last.filesystem.type.is?(:vfat)).to eq true
          end
        end
      end
    end

    context "when creating partitions in an empty space" do
      let(:scenario) { "space_22" }
      let(:distribution) do
        space_dist(disk_spaces.first => [root_vol, home_vol])
      end
      let(:primary) { Y2Storage::PartitionType::PRIMARY }

      context "if the space should have no logical partitions" do
        before do
          allow(distribution.spaces.first).to receive(:num_logical).and_return 0
        end

        it "creates all partitions as primary" do
          result = creator.create_partitions(distribution)
          expect(result.devicegraph.partitions).to contain_exactly(
            an_object_having_attributes(type: primary, name: "/dev/sda1"),
            an_object_having_attributes(type: primary, name: "/dev/sda2"),
            an_object_having_attributes(type: primary, filesystem_mountpoint: "/"),
            an_object_having_attributes(type: primary, filesystem_mountpoint: "/home")
          )
        end
      end

      context "if all the partitions in the space must be logical" do
        before do
          space = distribution.spaces.first
          allow(space).to receive(:num_logical).and_return space.partitions.size
        end

        it "creates no new primary partitions" do
          result = creator.create_partitions(distribution)
          primary = partitions(result.devicegraph, :primary)
          expect(primary).to contain_exactly(
            an_object_having_attributes(name: "/dev/sda1", size: 78.GiB),
            an_object_having_attributes(name: "/dev/sda2", size: 100.GiB - 1.MiB)
          )
        end

        it "creates an extended partition filling the whole space" do
          result = creator.create_partitions(distribution)
          extended = partitions(result.devicegraph, :extended)
          expect(extended).to contain_exactly(
            an_object_having_attributes(name: "/dev/sda3", size: 22.GiB)
          )
        end

        it "creates all the partitions as logical" do
          result = creator.create_partitions(distribution)
          logical = partitions(result.devicegraph, :logical)
          expect(logical).to contain_exactly(
            an_object_having_attributes(name: "/dev/sda5", size: 1.GiB),
            an_object_having_attributes(name: "/dev/sda6", size: 1.GiB)
          )
        end
      end

      context "if the space must mix logical and primary partitions" do
        before do
          space = distribution.spaces.first
          allow(space).to receive(:num_logical).and_return(space.partitions.size - 1)
        end

        it "creates as many primary partitions as needed" do
          result = creator.create_partitions(distribution)
          primary = partitions(result.devicegraph, :primary)
          expect(primary).to contain_exactly(
            an_object_having_attributes(name: "/dev/sda1", size: 78.GiB),
            an_object_having_attributes(name: "/dev/sda2", size: (100.GiB - 1.MiB)),
            an_object_having_attributes(name: "/dev/sda3", size: 1.GiB)
          )
        end

        it "creates an extended partition filling the remaining space" do
          result = creator.create_partitions(distribution)
          extended = partitions(result.devicegraph, :extended)
          expect(extended).to contain_exactly(
            an_object_having_attributes(name: "/dev/sda4", size: 21.GiB)
          )
        end

        it "creates logical partitions for the remaining partitions" do
          result = creator.create_partitions(distribution)
          logical = partitions(result.devicegraph, :logical)
          expect(logical).to contain_exactly an_object_having_attributes(name: "/dev/sda5",
            size: 1.GiB)
        end
      end
    end

    context "when creating partitions within an existing extended one" do
      let(:scenario) { "space_22_extended" }
      let(:distribution) do
        space_dist(disk_spaces.first => [root_vol, home_vol])
      end

      before do
        space = distribution.spaces.first
        allow(space).to receive(:num_logical).and_return space.partitions.size
      end

      it "reuses the extended partition" do
        result = creator.create_partitions(distribution)
        extended = partitions(result.devicegraph, :extended)
        expect(extended).to contain_exactly(
          an_object_having_attributes(name: "/dev/sda4", size: 22.GiB - 1.MiB)
        )
      end

      it "creates all the partitions as logical" do
        result = creator.create_partitions(distribution)
        logical = partitions(result.devicegraph, :logical)
        expect(logical).to contain_exactly(
          an_object_having_attributes(name: "/dev/sda5", size: 1.GiB),
          an_object_having_attributes(name: "/dev/sda6", size: 1.GiB)
        )
      end
    end

    context "when creating a partition" do
      let(:scenario) { "empty_hard_disk_mbr_50GiB" }
      let(:bootable) { false }

      let(:vol) do
        planned_vol(
          type: :vfat, partition_id: Y2Storage::PartitionId::ESP, min: 1.GiB, bootable: bootable
        )
      end
      let(:distribution) { space_dist(disk_spaces.first => [vol]) }

      it "correctly sets the libstorage partition id" do
        result = creator.create_partitions(distribution)
        partition = result.devicegraph.partitions.first
        expect(partition.id.is?(:esp)).to eq true
      end

      it "formats the partition" do
        result = creator.create_partitions(distribution)
        partition = result.devicegraph.partitions.first
        expect(partition.filesystem.type.is?(:vfat)).to eq true
      end

      context "if the partition must be encrypted" do
        before do
          vol.encryption_password = "s3cr3t"
        end

        it "formats the encrypted device instead of the plain partition" do
          result = creator.create_partitions(distribution)
          partition = result.devicegraph.partitions.first
          expect(partition.encryption.filesystem.type.is?(:vfat)).to eq true
        end
      end

      context "with a MBR partition table" do
        it "keeps the existing partition table" do
          old_table = fake_devicegraph.disks.first.partition_table
          result = creator.create_partitions(distribution)
          new_table = result.devicegraph.disks.first.partition_table

          expect(new_table.type.is?(:msdos)).to eq true
          expect(new_table).to eq old_table
        end

        context "if the partition is bootable" do
          let(:bootable) { true }

          it "sets the boot flag" do
            result = creator.create_partitions(distribution)
            partition = result.devicegraph.partitions.first
            expect(partition.boot?).to eq true
          end

          it "does not set the legacy boot flag" do
            result = creator.create_partitions(distribution)
            partition = result.devicegraph.partitions.first
            expect(partition.legacy_boot?).to eq false
          end
        end

        context "if the partition is not bootable" do
          it "does not set the boot flag" do
            result = creator.create_partitions(distribution)
            partition = result.devicegraph.partitions.first
            expect(partition.boot?).to eq false
          end

          it "does not set the legacy boot flag" do
            result = creator.create_partitions(distribution)
            partition = result.devicegraph.partitions.first
            expect(partition.legacy_boot?).to eq false
          end
        end
      end

      context "with a GPT partition table" do
        let(:scenario) { "empty_hard_disk_gpt_50GiB" }

        it "keeps the existing partition table" do
          old_table = fake_devicegraph.disks.first.partition_table
          result = creator.create_partitions(distribution)
          new_table = result.devicegraph.disks.first.partition_table

          expect(new_table.type.is?(:gpt)).to eq true
          expect(new_table).to eq old_table
        end

        context "if the partition is bootable" do
          let(:bootable) { true }

          it "does not set the boot flag" do
            result = creator.create_partitions(distribution)
            partition = result.devicegraph.partitions.first
            expect(partition.boot?).to eq false
          end

          it "does not set the legacy boot flag" do
            result = creator.create_partitions(distribution)
            partition = result.devicegraph.partitions.first
            expect(partition.legacy_boot?).to eq false
          end
        end

        context "if the partition is not bootable" do
          it "does not set the boot flag" do
            result = creator.create_partitions(distribution)
            partition = result.devicegraph.partitions.first
            expect(partition.boot?).to eq false
          end

          it "does not set the legacy boot flag" do
            result = creator.create_partitions(distribution)
            partition = result.devicegraph.partitions.first
            expect(partition.legacy_boot?).to eq false
          end
        end
      end

      context "with an implicit partition table" do
        let(:scenario) { "several-dasds" }

        let(:dasda) { fake_devicegraph.find_by_name("/dev/dasda") }

        let(:distribution) { space_dist(dasda.free_spaces.first => [vol]) }

        it "keeps the existing implicit partition table" do
          old_table = dasda.partition_table

          result = creator.create_partitions(distribution)
          dasda = result.devicegraph.find_by_name("/dev/dasda")
          new_table = dasda.partition_table

          expect(new_table).to eq(old_table)
        end

        it "keeps the existing single partition" do
          old_partition = dasda.partition_table.partition

          result = creator.create_partitions(distribution)
          dasda = result.devicegraph.find_by_name("/dev/dasda")
          new_partition = dasda.partition_table.partition

          expect(new_partition.sid).to eq(old_partition.sid)
        end

        it "does not change the partition id" do
          result = creator.create_partitions(distribution)
          dasda = result.devicegraph.find_by_name("/dev/dasda")
          partition = dasda.partition_table.partition

          expect(partition.id).to_not eq(vol.partition_id)
        end

        context "if the partition is bootable" do
          let(:bootable) { true }

          it "does not set the boot flag" do
            result = creator.create_partitions(distribution)
            dasda = result.devicegraph.find_by_name("/dev/dasda")
            partition = dasda.partition_table.partition

            expect(partition.boot?).to eq(false)
          end

          it "does not set the legacy boot flag" do
            result = creator.create_partitions(distribution)
            dasda = result.devicegraph.find_by_name("/dev/dasda")
            partition = dasda.partition_table.partition

            expect(partition.legacy_boot?).to eq(false)
          end
        end

        context "if the partition is not bootable" do
          it "does not set the boot flag" do
            result = creator.create_partitions(distribution)
            dasda = result.devicegraph.find_by_name("/dev/dasda")
            partition = dasda.partition_table.partition

            expect(partition.boot?).to eq(false)
          end

          it "does not set the legacy boot flag" do
            result = creator.create_partitions(distribution)
            dasda = result.devicegraph.find_by_name("/dev/dasda")
            partition = dasda.partition_table.partition

            expect(partition.legacy_boot?).to eq(false)
          end
        end
      end

      context "if there is no partition table in the disk" do
        let(:scenario) { "empty_hard_disk_50GiB" }

        it "creates a new partition table of the preferred type" do
          result = creator.create_partitions(distribution)
          table = result.devicegraph.disks.first.partition_table

          expect(table.type.is?(:gpt)).to eq true
        end
      end
    end
  end
end
