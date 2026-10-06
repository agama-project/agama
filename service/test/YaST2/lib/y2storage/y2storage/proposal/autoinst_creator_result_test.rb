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

require "y2storage/proposal/autoinst_creator_result"

describe Y2Storage::Proposal::AutoinstCreatorResult do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject(:result) { described_class.new(creator_result, planned_devices) }

  let(:planned_part1) { planned_partition(min_size: 5.GiB) }
  let(:planned_vg1) do
    Y2Storage::Planned::LvmVg.new(volume_group_name: "system", lvs: [planned_lv1])
  end
  let(:planned_lv1) { planned_lv(min_size: 10.GiB) }

  let(:shrinked_part1) do
    instance_double(
      Y2Storage::Planned::Partition,
      planned_id: planned_part1.planned_id,
      min_size:   Y2Storage::DiskSize.B(1)
    )
  end

  let(:shrinked_lv1) do
    instance_double(
      Y2Storage::Planned::LvmLv, planned_id: planned_lv1.planned_id,
                                 min_size:   Y2Storage::DiskSize.B(1)
    )
  end

  let(:real_part1) { instance_double(Y2Storage::Partition, size: 2.GiB) }
  let(:real_lv1) { instance_double(Y2Storage::LvmLv, size: 5.GiB) }
  let(:planned_devices) { [planned_part1, planned_vg1] }

  let(:devices_map) do
    {
      "/dev/sda1"        => shrinked_part1,
      "/dev/system/root" => shrinked_lv1
    }
  end

  let(:devicegraph) do
    instance_double(Y2Storage::Devicegraph)
  end

  let(:creator_result) do
    Y2Storage::Proposal::CreatorResult.new(devicegraph, devices_map)
  end

  let(:blk_devices_map) do
    {
      "/dev/sda1"        => real_part1,
      "/dev/system/root" => real_lv1
    }
  end

  before do
    allow(Y2Storage::BlkDevice).to receive(:find_by_name) do |_devicegraph, name|
      blk_devices_map[name]
    end
  end

  describe "#real_device_by_planned_id" do
    it "returns the real device for a given planned device" do
      expect(result.real_device_by_planned_id(planned_part1.planned_id)).to eq(real_part1)
    end

    context "when planned device does not exist" do
      it "returns nil" do
        expect(result.real_device_by_planned_id("dummy-id")).to be_nil
      end
    end
  end

  describe "#shrinked_partitions" do
    it "returns a list of DeviceShrinkage objects (one for each shrinked partition)" do
      shrinked_partitions = result.shrinked_partitions
      expect(shrinked_partitions).to be_a(Array)
      shrinking_info = shrinked_partitions.first
      expect(shrinking_info.planned).to eq(planned_part1)
      expect(shrinking_info.real).to eq(real_part1)
      expect(shrinking_info.diff).to eq(3.GiB)
    end

    context "when no partition was shrinked" do
      let(:real_part1) { instance_double(Y2Storage::Partition, size: planned_part1.min_size) }

      it "returns an empty array" do
        expect(result.shrinked_partitions).to eq([])
      end
    end
  end

  describe "#shrinked_lvs" do
    it "returns a list of DeviceShrinkage objects (one for each shrinked LV)" do
      shrinked_lvs = result.shrinked_lvs
      expect(shrinked_lvs).to be_a(Array)
      shrinking_info = shrinked_lvs.first
      expect(shrinking_info.planned).to eq(planned_lv1)
      expect(shrinking_info.real).to eq(real_lv1)
      expect(shrinking_info.diff).to eq(5.GiB)
    end

    context "when no partition was shrinked" do
      let(:planned_lv1) { planned_lv(min_size: 5.GiB) }

      it "returns an empty array" do
        expect(result.shrinked_lvs).to eq([])
      end
    end
  end

  describe "#missing_space" do
    context "when some partition was shrinked" do
      let(:planned_devices) { [planned_part1, planned_vg1] }

      it "returns the missing space ignoring the logical volumes" do
        expect(result.missing_space).to eq(3.GiB)
      end
    end

    context "when no partition was shrinked" do
      context "but some LVs were shrinked" do
        let(:planned_devices) { [planned_vg1] }

        it "returns missing space for logical volumes" do
          expect(result.missing_space).to eq(5.GiB)
        end
      end

      context "and no LVs were shrinked" do
        let(:planned_devices) { [] }

        it "returns DiskSize.zero" do
          expect(result.missing_space).to eq(Y2Storage::DiskSize.zero)
        end
      end
    end
  end
end
