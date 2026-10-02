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

describe Y2Storage::Proposal::LvmHelper do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  before do
    fake_scenario(scenario)
    settings.encryption_password = enc_password
    settings.lvm_vg_strategy = lvm_vg_strategy
  end

  subject(:helper) { described_class.new(volumes_list, settings) }
  let(:volumes_list) { volumes }
  let(:volumes) { [] }
  let(:settings) { Y2Storage::ProposalSettings.new }
  let(:enc_password) { nil }
  let(:lvm_vg_strategy) { :use_needed }

  describe "#reusable_volume_groups" do
    context "if there are no volume groups" do
      let(:scenario) { "windows-pc" }
      let(:volumes) { [planned_lv(mount_point: "/1", type: :ext4, min: 10.GiB)] }

      it "returns an empty array" do
        expect(helper.reusable_volume_groups(fake_devicegraph)).to eq []
      end
    end

    context "if no volume group is big enough" do
      let(:scenario) { "lvm-four-vgs" }
      let(:volumes) { [planned_lv(mount_point: "/1", type: :ext4, min: 40.GiB)] }

      it "returns all the volume groups sorted by descending size" do
        result = helper.reusable_volume_groups(fake_devicegraph)
        expect(result.map(&:vg_name)).to eq ["vg30", "vg10", "vg6", "vg4"]
      end

      context "and encryption is being used" do
        let(:enc_password) { "12345678" }

        it "returns an empty array" do
          expect(helper.reusable_volume_groups(fake_devicegraph)).to eq []
        end
      end

      context "and ProposalSettings#lvm_vg_reuse is set to false" do
        before { settings.lvm_vg_reuse = false }

        it "returns an empty array" do
          expect(helper.reusable_volume_groups(fake_devicegraph)).to eq []
        end
      end
    end

    context "if some volume groups are big enough" do
      let(:scenario) { "lvm-four-vgs" }
      let(:volumes) { [planned_lv(mount_point: "/1", type: :ext4, min: 8.GiB)] }

      it "returns all the volume groups" do
        result = helper.reusable_volume_groups(fake_devicegraph)
        expect(result.size).to eq 4
      end

      it "prefers big-enough groups sorted by ascending size" do
        result = helper.reusable_volume_groups(fake_devicegraph)
        expect(result[0].vg_name).to eq "vg10"
        expect(result[1].vg_name).to eq "vg30"
      end

      it "puts at the end all the groups that are not big enough, by descending size" do
        result = helper.reusable_volume_groups(fake_devicegraph)
        expect(result[2].vg_name).to eq "vg6"
        expect(result[3].vg_name).to eq "vg4"
      end

      context "and encryption is being used" do
        let(:enc_password) { "12345678" }

        it "returns an empty array" do
          expect(helper.reusable_volume_groups(fake_devicegraph)).to eq []
        end
      end

      context "and the logical volumes are assigned to a concrete disk" do
        before { volumes.first.disk = "/dev/sda" }

        it "returns an empty array" do
          expect(helper.reusable_volume_groups(fake_devicegraph)).to eq []
        end
      end

      context "and ProposalSettings#lvm_vg_reuse is set to false" do
        before { settings.lvm_vg_reuse = false }

        it "returns an empty array" do
          expect(helper.reusable_volume_groups(fake_devicegraph)).to eq []
        end
      end
    end
  end

  describe "#create_volumes" do
    let(:scenario) { "lvm-new-pvs" }
    let(:volumes) do
      [
        planned_lv(mount_point: "/1", type: :ext4, logical_volume_name: "one", min: 10.GiB),
        planned_lv(mount_point: "/2", type: :ext4, logical_volume_name: "two", min: 5.GiB)
      ]
    end
    let(:lvm_creator) { Y2Storage::Proposal::LvmCreator.new(fake_devicegraph) }
    let(:pv_partitions) { ["/dev/sda1", "/dev/sda3"] }
    let(:creator_result) { double("Y2Storage::Proposal::CreatorResult", devicegraph: nil) }

    before do
      allow(Y2Storage::Proposal::LvmCreator).to receive(:new).and_return(lvm_creator)
    end

    it "creates a new volume group" do
      devicegraph = helper.create_volumes(fake_devicegraph, pv_partitions)
      vgs = devicegraph.lvm_vgs
      expect(vgs.size).to eq 2
      expect(vgs.map(&:vg_name)).to include "system"
    end

    it "adds the new physical volumes to the new volume group" do
      expect(lvm_creator).to receive(:create_volumes)
        .with(Y2Storage::Planned::LvmVg, pv_partitions).and_return creator_result
      helper.create_volumes(fake_devicegraph, pv_partitions)
    end

    it "adds the logical volumes to the volume group to be created" do
      expect(lvm_creator).to receive(:create_volumes) do |lvm_vg, _pv_partitions|
        expect(lvm_vg.lvs).to eq(volumes)
      end.and_return creator_result
      helper.create_volumes(fake_devicegraph, pv_partitions)
    end

    context "if an existing volume group is reused" do
      let(:reused_vg) { fake_devicegraph.lvm_vgs.first }

      before do
        helper.reused_volume_group = reused_vg
      end

      it "reuses the given volume group" do
        expect(lvm_creator).to receive(:create_volumes) do |lvm_vg, _pv_partitions|
          expect(lvm_vg.reuse_name).to eq(reused_vg.vg_name)
        end.and_return creator_result
        helper.create_volumes(fake_devicegraph, pv_partitions)
      end
    end

    context "when the volume group is empty" do
      let(:volumes) { [] }

      it "does not create it" do
        expect(Y2Storage::Proposal::LvmCreator).to_not receive(:new)
        helper.create_volumes(fake_devicegraph, pv_partitions)
      end

      it "returns a copy of the original devicegraph" do
        devicegraph = helper.create_volumes(fake_devicegraph, pv_partitions)
        expect(devicegraph).to_not be(fake_devicegraph)
      end
    end
  end
end
