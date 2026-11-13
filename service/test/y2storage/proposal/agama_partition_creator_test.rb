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

require "storage"
require "y2storage"
require "y2storage/proposal/agama_partition_creator"

describe Y2Storage::Proposal::AgamaPartitionCreator do
  include_context "yast2-storage-ng test setup"

  describe "#create_partitions" do
    using Y2Storage::Refinements::SizeCasts

    subject(:creator) { described_class.new(fake_devicegraph) }

    before do
      fake_scenario(scenario)
    end

    let(:disk_spaces) { fake_devicegraph.free_spaces }

    context "when no partition id is planned" do
      let(:scenario) { "empty_hard_disk_gpt_50GiB" }

      let(:distribution) { space_dist(disk_spaces.first => [vol]) }

      let(:vol) { planned_vol(mount_point: mount_point, type: fs_type, min: 1.GiB) }
      let(:mount_point) { "/" }
      let(:fs_type) { :ext4 }

      let(:ids) { Y2Storage::PartitionId }

      let(:partition) do
        result = creator.create_partitions(distribution)
        result.devicegraph.partitions.first
      end

      before do
        allow(Yast::Arch).to receive(:x86_64).and_return(true)
      end

      context "with a GPT partition table" do
        {
          "/"        => :LINUX_ROOT_X86_64,
          "/usr"     => :LINUX_USR_X86_64,
          "/home"    => :LINUX_HOME,
          "/srv"     => :LINUX_SERVER_DATA,
          "/var"     => :LINUX_VAR,
          "/var/tmp" => :LINUX_VAR_TMP
        }.each do |path, id|
          context "and the mount point is #{path}" do
            let(:mount_point) { path }

            it "sets the id defined by the Discoverable Partitions Specification" do
              expect(partition.id).to eq(ids.const_get(id))
            end
          end
        end

        context "and the mount point has no discoverable id" do
          let(:mount_point) { "/opt" }

          it "sets the linux id" do
            expect(partition.id).to eq(ids::LINUX)
          end
        end

        context "and the partition has no mount point" do
          let(:mount_point) { nil }

          it "sets the linux id" do
            expect(partition.id).to eq(ids::LINUX)
          end
        end

        context "and the partition is for swap" do
          let(:mount_point) { "swap" }
          let(:fs_type) { :swap }

          it "sets the swap id" do
            expect(partition.id).to eq(ids::SWAP)
          end
        end

        context "and the partition must be encrypted" do
          let(:mount_point) { "/home" }

          before { vol.encryption_password = "s3cr3t" }

          it "sets the id in the partition holding the encryption" do
            expect(partition.id).to eq(ids::LINUX_HOME)
          end
        end

        context "and the partition is used as LVM physical volume" do
          let(:mount_point) { "/home" }

          before { vol.lvm_volume_group_name = "vg0" }

          it "sets the linux id" do
            expect(partition.id).to eq(ids::LINUX)
          end
        end

        context "and the partition is a physical volume with the LVM id" do
          let(:mount_point) { nil }

          before do
            vol.partition_id = ids::LVM
            vol.lvm_volume_group_name = "vg0"
          end

          it "sets the LVM id" do
            expect(partition.id).to eq(ids::LVM)
          end
        end

        context "and the partition is a member of a MD RAID" do
          let(:mount_point) { "/home" }

          before { vol.raid_name = "/dev/md0" }

          it "sets the linux id" do
            expect(partition.id).to eq(ids::LINUX)
          end
        end

        context "and the architecture has no discoverable id for the root" do
          let(:mount_point) { "/" }

          before do
            allow(Yast::Arch).to receive(:x86_64).and_return(false)
            [:i386, :aarch64, :arm, :ppc32, :ppc64, :riscv64, :s390_32,
             :s390_64].each do |name|
              allow(Yast::Arch).to receive(name).and_return(false)
            end
          end

          it "sets the linux id" do
            expect(partition.id).to eq(ids::LINUX)
          end
        end
      end

      context "with a MBR partition table" do
        let(:scenario) { "empty_hard_disk_mbr_50GiB" }

        ["/", "/home", "/var"].each do |path|
          context "and the mount point is #{path}" do
            let(:mount_point) { path }

            it "sets the linux id" do
              expect(partition.id).to eq(ids::LINUX)
            end
          end
        end
      end

      context "with a DASD partition table" do
        let(:scenario) { "empty_dasd_50GiB" }

        ["/", "/home", "/var"].each do |path|
          context "and the mount point is #{path}" do
            let(:mount_point) { path }

            it "sets the linux id" do
              expect(partition.id).to eq(ids::LINUX)
            end
          end
        end
      end

      context "with an implicit partition table" do
        let(:scenario) { "several-dasds" }

        let(:mount_point) { "/home" }

        let(:dasda) { fake_devicegraph.find_by_name("/dev/dasda") }

        let(:distribution) { space_dist(dasda.free_spaces.first => [vol]) }

        it "does not set the id of the discoverable partitions" do
          result = creator.create_partitions(distribution)
          dasda = result.devicegraph.find_by_name("/dev/dasda")

          expect(dasda.partition_table.partition.id).to_not eq(ids::LINUX_HOME)
        end
      end

      context "with a GPT partition table in a FBA DASD" do
        let(:scenario) { "empty_dasd_fba_gpt" }

        let(:mount_point) { "/home" }

        it "sets the id defined by the Discoverable Partitions Specification" do
          expect(partition.id).to eq(ids::LINUX_HOME)
        end
      end
    end

    context "when a partition id is planned" do
      let(:scenario) { "empty_hard_disk_gpt_50GiB" }

      let(:distribution) { space_dist(disk_spaces.first => [vol]) }

      let(:vol) do
        planned_vol(
          mount_point: "/home", type: :ext4, min: 1.GiB, partition_id: Y2Storage::PartitionId::LINUX
        )
      end

      before do
        allow(Yast::Arch).to receive(:x86_64).and_return(true)
      end

      it "does not replace it with the id defined by the Discoverable Partitions Specification" do
        result = creator.create_partitions(distribution)
        partition = result.devicegraph.partitions.first

        expect(partition.id).to eq(Y2Storage::PartitionId::LINUX)
      end
    end
  end
end
