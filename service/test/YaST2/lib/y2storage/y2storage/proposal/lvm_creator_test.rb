#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2016-2021] SUSE LLC
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

describe Y2Storage::Proposal::LvmCreator do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject(:creator) { described_class.new(fake_devicegraph) }

  let(:reused_vg) { nil }
  let(:vg) { planned_vg(volume_group_name: "system", lvs: volumes) }
  let(:volumes) { [] }

  before do
    fake_scenario(scenario)
    vg.reuse_name = reused_vg.vg_name if reused_vg
  end

  describe "#create_volumes" do
    let(:scenario) { "lvm-new-pvs" }
    let(:volumes) do
      [
        planned_lv(
          mount_point: "/1", type: :ext4, logical_volume_name: "one", min: 10.GiB,
          stripe_size: 8.KiB, stripes: 4
        ),
        planned_lv(mount_point: "/2", type: :ext4, logical_volume_name: "two", min: 5.GiB)
      ]
    end
    let(:pv_partitions) { ["/dev/sda1", "/dev/sda3"] }
    let(:ext4) { Y2Storage::Filesystems::Type::EXT4 }

    let(:vg) { planned_vg(volume_group_name: "system", lvs: volumes) }

    context "if a non-valid strategy is configured at the proposal space settings" do
      subject(:creator) { described_class.new(fake_devicegraph, space_settings) }

      let(:space_settings) do
        Y2Storage::ProposalSpaceSettings.new.tap do |settings|
          settings.strategy = :invented
        end
      end

      it "raises an exception" do
        expect { creator.create_volumes(vg, pv_partitions) }.to raise_exception(ArgumentError)
      end
    end

    context "if no volume group is reused" do
      it "creates a new volume group" do
        devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
        vgs = devicegraph.lvm_vgs
        expect(vgs.size).to eq 2
        expect(vgs.map(&:vg_name)).to include "system"
      end

      context "and an extent size is given" do
        before do
          vg.extent_size = 8.MiB
        end

        it "sets the volume group extent size to the given size" do
          devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
          real_vg = devicegraph.lvm_vgs.find { |vg| vg.vg_name == "system" }
          expect(real_vg.extent_size).to eq(vg.extent_size)
        end
      end

      it "adds the new physical volumes to the new volume group" do
        devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
        new_vg = devicegraph.lvm_vgs.detect { |vg| vg.vg_name == "system" }
        pv_names = new_vg.lvm_pvs.map { |pv| pv.blk_device.name }
        expect(pv_names.sort).to eq pv_partitions.sort
      end

      context "when a partition used as physical volume contains a filesystem" do
        let(:scenario) { "windows-linux-free-pc" }

        it "removes the filesystem" do
          devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
          reused_vg = devicegraph.lvm_vgs.detect { |vg| vg.vg_name == "system" }
          pv_names = reused_vg.lvm_pvs.map { |pv| pv.blk_device.name }
          expect(pv_names.sort).to eq pv_partitions.sort
        end
      end

      it "creates a new logical volume for each planned volume" do
        devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
        new_vg = devicegraph.lvm_vgs.detect { |vg| vg.vg_name == "system" }
        expect(new_vg.lvm_lvs).to contain_exactly(
          an_object_having_attributes(
            filesystem_mountpoint: "/1",
            lv_name:               "one",
            filesystem_type:       ext4,
            stripe_size:           8.KiB,
            stripes:               4
          ),
          an_object_having_attributes(
            filesystem_mountpoint: "/2",
            lv_name:               "two",
            filesystem_type:       ext4
          )
        )
      end

      context "if the planned volume group does not contain any logical volume" do
        let(:vg) { planned_vg(volume_group_name: "custom_vg", lvs: []) }

        it "creates the volume group anyway" do
          devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
          vgs = devicegraph.lvm_vgs
          expect(vgs.map(&:vg_name)).to include "custom_vg"
        end
      end

      context "and encryption is used" do
        let(:scenario) { "lvm-new-encrypted-pvs" }
        let(:enc_password) { "SomePassphrase" }

        it "uses the encrypted devices to create the physical volumes" do
          devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
          new_vg = devicegraph.lvm_vgs.detect { |vg| vg.vg_name == "system" }
          pv_devices = new_vg.lvm_pvs.map(&:blk_device)

          pv_devices.each do |device|
            expect(device.is?(:encryption)).to eq true
          end
          part_names = pv_devices.map { |d| d.blk_device.plain_device.name }
          expect(part_names.sort).to eq pv_partitions.sort
        end
      end
    end

    context "if an existing volume group is reused" do
      let(:reused_vg) { fake_devicegraph.lvm_vgs.first }

      before do
        vg.reuse_name = reused_vg.vg_name
      end

      it "creates no additional volume group" do
        devicegraph = creator.create_volumes(vg).devicegraph
        vgs = devicegraph.lvm_vgs
        expect(vgs.size).to eq 1
      end

      it "adds the new physical volumes to the existing volume group" do
        devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
        reused_vg = devicegraph.lvm_vgs.detect { |vg| vg.vg_name == "vg0" }
        pv_names = reused_vg.lvm_pvs.map { |pv| pv.blk_device.name }
        expect(pv_names.sort).to eq ["/dev/sda1", "/dev/sda2", "/dev/sda3"]
      end

      context "and an extent size is given" do
        before do
          vg.extent_size = reused_vg.extent_size * 2
        end

        it "does not change the original extent size" do
          original_extent_size = reused_vg.extent_size
          devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
          real_vg = devicegraph.lvm_vgs.find { |vg| vg.vg_name == reused_vg.vg_name }
          expect(real_vg.extent_size).to eq(original_extent_size)
        end
      end

      context "when a physical volume is already part of the volume group" do
        let(:pv_partitions) { ["/dev/sda2"] }

        it "does not add it again" do
          devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
          reused_vg = devicegraph.lvm_vgs.detect { |vg| vg.vg_name == "vg0" }
          pv_names = reused_vg.lvm_pvs.map { |pv| pv.blk_device.name }
          expect(pv_names.sort).to eq ["/dev/sda2"]
        end
      end

      it "creates a new logical volume for each planned volume" do
        devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
        reused_vg = devicegraph.lvm_vgs.first
        one = reused_vg.lvm_lvs.detect { |lv| lv.lv_name == "one" }
        expect(one).to have_attributes(filesystem_mountpoint: "/1", filesystem_type: ext4)
        two = reused_vg.lvm_lvs.detect { |lv| lv.lv_name == "two" }
        expect(two).to have_attributes(filesystem_mountpoint: "/2", filesystem_type: ext4)
      end

      it "does not delete existing LVs if there is enough free space" do
        devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
        reused_vg = devicegraph.lvm_vgs.first
        lv_names = reused_vg.lvm_lvs.map(&:lv_name)
        expect(lv_names).to include("lv1", "lv2")
      end

      context "when there is not enough space" do
        before do
          volumes << planned_lv(type: :ext4, logical_volume_name: "three", min: 20.GiB)
        end

        it "deletes existing LVs as needed to make space" do
          devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
          reused_vg = devicegraph.lvm_vgs.first
          lv_names = reused_vg.lvm_lvs.map(&:lv_name)
          expect(lv_names).to_not include "lv2"
          expect(lv_names).to include "lv1"
        end

        context "if there are LVs with snapshots" do
          let(:scenario) { "lvm-types1.xml" }
          let(:pv_partitions) { [] }

          # Ensure we have to delete some volumes, but not all
          before { volumes.last.min = 7.GiB }

          it "deletes the snapshots of the removed LVs " do
            devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
            reused_vg = devicegraph.lvm_vgs.first
            lv_names = reused_vg.lvm_lvs.map(&:lv_name)
            expect(lv_names).to_not include "normal1"
            expect(lv_names).to_not include "snap_normal1"
          end
        end

        context "and make policy is set to :keep" do
          before { vg.make_space_policy = :keep }

          it "does not delete any LV" do
            volumes << planned_lv(type: :ext4, logical_volume_name: "three", min: 20.GiB)
            expect { creator.create_volumes(vg, pv_partitions) }.to raise_error(RuntimeError)
          end
        end
      end

      context "when make space policy is set to :remove" do
        before { vg.make_space_policy = :remove }

        context "and no LV is reused" do
          it "deletes all existing LVs" do
            devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
            reused_vg = devicegraph.lvm_vgs.first
            lv_names = reused_vg.lvm_lvs.map(&:lv_name)
            expect(lv_names).to contain_exactly("one", "two")
          end
        end

        context "and some LV should be reused" do
          before do
            reused_lv = vg.lvs.first
            reused_lv.reuse_name = "/dev/vg0/lv1"
          end

          it "deletes all existing LVs but the reusable one" do
            devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
            reused_vg = devicegraph.lvm_vgs.first
            lv_names = reused_vg.lvm_lvs.map(&:lv_name)
            expect(lv_names).to contain_exactly("lv1", "two")
          end
        end
      end
    end

    context "if the exact space is available" do
      let(:reused_vg) { nil }

      before do
        volumes.first.min_size = 15.GiB - 4.MiB
        volumes.last.min_size = 5.GiB - 4.MiB
      end

      it "creates partitions matching the volume sizes" do
        devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
        lvs = devicegraph.lvm_lvs.select { |lv| lv.lvm_vg.vg_name == "system" }

        expect(lvs).to contain_exactly(
          an_object_having_attributes(lv_name: "one", size: 15.GiB - 16.MiB),
          an_object_having_attributes(lv_name: "two", size: 5.GiB - 4.MiB)
        )
      end
    end

    context "if some extra space is available" do
      let(:reused_vg) { nil }

      before do
        one = volumes.first
        two = volumes.last
        volumes << planned_lv(logical_volume_name: "three", min: 1.GiB, max: 2.GiB, weight: 1)

        one.min_size = 5.GiB
        one.weight = 2
        two.min_size = 7.GiB
        two.weight = 1
      end

      it "distributes the extra space according to weights" do
        devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
        lvs = devicegraph.lvm_lvs.select { |lv| lv.lvm_vg.vg_name == "system" }

        expect(lvs).to contain_exactly(
          an_object_having_attributes(lv_name: "one", size: 9.GiB - 16.MiB),
          an_object_having_attributes(lv_name: "two", size: 9.GiB - 4.MiB),
          an_object_having_attributes(lv_name: "three", size: 2.GiB)
        )
      end

      it "does not distribute more space than available" do
        devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
        system_vg = devicegraph.lvm_vgs.detect { |vg| vg.vg_name == "system" }
        lvs = system_vg.lvm_lvs
        lvs_size = lvs.reduce(Y2Storage::DiskSize.zero) { |sum, lv| sum + lv.size }

        expect(system_vg.size >= lvs_size).to eq(true)
      end
    end

    context "when the volume group name is already taken" do
      let(:scenario) { "lvm-name-conflicts" }
      let(:reused_vg) { nil }
      let(:pv_partitions) { ["/dev/sda2"] }

      it "chooses a new name adding a number" do
        devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
        vg_names = devicegraph.lvm_vgs.map(&:vg_name)
        expect(vg_names).to contain_exactly("system", "system0")
      end
    end

    context "when a logical volume name is already taken" do
      let(:scenario) { "lvm-name-conflicts" }
      let(:reused_vg) { fake_devicegraph.lvm_vgs.first }
      let(:pv_partitions) { [] }

      it "chooses a new name adding a number" do
        devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
        lv_names = devicegraph.lvm_lvs.map(&:lv_name)
        expect(lv_names).to include("one", "one0", "one1", "one2")
      end
    end

    context "when size is expressed as a percentage" do
      let(:reused_vg) { nil }
      let(:pv_partitions) { ["/dev/sda2"] }

      before do
        volumes.first.percent_size = 50
        volumes.last.weight = 1
      end

      it "creates partitions matching the volume sizes" do
        devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
        lvs = devicegraph.lvm_lvs.select { |lv| lv.lvm_vg.vg_name == "system" }

        expect(lvs).to contain_exactly(
          an_object_having_attributes(lv_name: "one", size: 15.GiB - 16.MiB),
          an_object_having_attributes(lv_name: "two", size: 15.GiB)
        )
      end
    end

    context "when using a thin pool" do
      let(:planned_root) do
        planned_lv(
          mount_point: "/", type: :ext4, logical_volume_name: "root", min: 5.GiB,
          lv_type: Y2Storage::LvType::THIN
        )
      end

      let(:planned_pool) do
        planned_lv(
          logical_volume_name: "pool0", min: 18.GiB, lv_type: Y2Storage::LvType::THIN_POOL
        )
      end

      let(:volumes) { [planned_pool] }

      before do
        planned_pool.add_thin_lv(planned_root)
      end

      it "creates thin logical volumes on top of the pool" do
        devicegraph = creator.create_volumes(vg, pv_partitions).devicegraph
        pool = devicegraph.lvm_lvs.find { |lv| lv.lv_name == "pool0" }
        expect(pool.lv_type).to eq(Y2Storage::LvType::THIN_POOL)
        expect(pool.lvm_lvs).to contain_exactly(
          an_object_having_attributes(lv_name: "root", lv_type: Y2Storage::LvType::THIN)
        )
      end
    end
  end

  describe "#reuse_volumes" do
    let(:scenario) { "lvm-two-vgs" }
    let(:root_lv) do
      planned_lv(
        mount_point: "/", type: :ext4, logical_volume_name: "two", reuse_name: "/dev/vg0/lv1"
      )
    end
    let(:volumes) { [root_lv] }
    let(:reused_vg) { fake_devicegraph.lvm_vgs.first }

    it "reuses the logical volumes" do
      devicegraph = creator.reuse_volumes(vg).devicegraph
      reused_lv = devicegraph.lvm_lvs.find { |v| v.lv_name == "lv1" }
      expect(reused_lv.mount_point.path).to eq("/")
    end
  end
end
