#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2019] SUSE LLC
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

require "y2storage/planned"

describe Y2Storage::Planned::LvmVg do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject(:lvm_vg) { described_class.new(volume_group_name: name) }

  let(:lv_root) { Y2Storage::Planned::LvmLv.new("/", :ext4) }
  let(:name) { "system" }
  let(:scenario) { "lvm-two-vgs" }
  let(:vg0) { fake_devicegraph.lvm_vgs.find { |v| v.vg_name == "vg0" } }

  before do
    fake_scenario(scenario)
  end

  describe ".from_real_vg" do
    subject(:planned_vg) { described_class.from_real_vg(vg0) }

    it "builds a new instance" do
      expect(planned_vg.volume_group_name).to eq(vg0.vg_name)
    end

    it "sets extent_size" do
      expect(planned_vg.extent_size).to eq(vg0.extent_size)
    end

    it "sets total_size" do
      expect(planned_vg.total_size).to eq(vg0.total_size)
    end

    it "sets reuse" do
      expect(planned_vg.reuse_name).to eq(vg0.vg_name)
    end

    it "sets pvs" do
      expect(planned_vg.pvs).to eq(["/dev/sda7"])
    end

    it "sets lvs" do
      expect(planned_vg.lvs.map(&:logical_volume_name)).to contain_exactly("lv1", "lv2")
    end
  end

  describe "#volume_group_name" do
    it "returns the volume group name" do
      expect(lvm_vg.volume_group_name).to eq(name)
    end
  end

  describe "#reuse!" do
    before do
      lvm_vg.reuse_name = name
    end

    it "finds the device to reuse" do
      expect(Y2Storage::LvmVg).to receive(:find_by_vg_name).with(fake_devicegraph, name)
      lvm_vg.reuse!(fake_devicegraph)
    end
  end

  describe "#all_lvs" do
    subject(:lvm_lv) { planned_lv(lv_type: Y2Storage::LvType::THIN_POOL) }
    let(:thin_lv) { planned_lv(lv_type: Y2Storage::LvType::THIN) }

    before do
      lvm_lv.add_thin_lv(thin_lv)
      lvm_vg.lvs << lvm_lv
    end

    it "returns all logical volumes even those included in thin pools" do
      expect(lvm_vg.all_lvs).to eq([lvm_lv, thin_lv])
    end
  end

  describe "#missing_space" do
    let(:scenario) { "lvm-big-pe" }
    let(:vg_big_pe) { Y2Storage::LvmVg.find_by_vg_name(fake_devicegraph, "vg0") }

    before { lvm_vg.lvs = volumes }

    context "if no LVM volumes are planned" do
      let(:volumes) { [] }

      it "returns zero" do
        expect(lvm_vg.missing_space).to be_zero
      end
    end

    context "if some LVM volumes are planned" do
      let(:volumes) { [planned_lv(mount_point: "/1", type: :ext4, min: desired)] }

      context "and no volume group is being reused" do
        let(:desired) { 10.GiB - 2.MiB }

        it "returns the target size rounded up to the default extent size" do
          expect(lvm_vg.missing_space).to eq 10.GiB
        end
      end

      context "and a big-enough volume group is being reused" do
        subject(:lvm_vg) { Y2Storage::Planned::LvmVg.from_real_vg(vg_big_pe) }
        let(:desired) { 10.GiB }

        it "returns zero" do
          expect(lvm_vg.missing_space).to be_zero
        end
      end

      context "and a volume group that needs to be extended is being reused" do
        subject(:lvm_vg) { Y2Storage::Planned::LvmVg.from_real_vg(vg_big_pe) }
        let(:desired) { 20.GiB + 2.MiB }

        it "returns the missing size rounded up to the VG extent size" do
          missing = desired - vg_big_pe.size
          # Extent size of vg_big_pe is 64 MiB
          rounding = 62.MiB
          expect(lvm_vg.missing_space).to eq(missing + rounding)
        end
      end
    end
  end

  describe "#max_extra_space" do
    let(:scenario) { "lvm-big-pe" }
    let(:vg_big_pe) { Y2Storage::LvmVg.find_by_vg_name(fake_devicegraph, "vg0") }

    before { lvm_vg.lvs = volumes }

    context "if no LVM volumes are planned" do
      let(:volumes) { [] }

      it "returns zero" do
        expect(lvm_vg.max_extra_space).to be_zero
      end
    end

    context "if some LVM volumes are planned" do
      let(:volumes) { [planned_lv(mount_point: "/1", type: :ext4, min: 1.GiB, max: max)] }

      context "and the max size is unlimited" do
        let(:reused_vg) { nil }
        let(:unlimited) { Y2Storage::DiskSize.unlimited }
        let(:max) { unlimited }

        it "returns unlimited" do
          expect(lvm_vg.max_extra_space).to eq unlimited
        end
      end

      context "and no volume group is being reused" do
        let(:reused_vg) { nil }
        let(:max) { 30.GiB - 1.MiB }

        it "returns the max size rounded up to the default extent size" do
          expect(lvm_vg.max_extra_space).to eq 30.GiB
        end
      end

      context "and a volume group is being reused" do
        subject(:lvm_vg) { Y2Storage::Planned::LvmVg.from_real_vg(vg_big_pe) }
        let(:max) { 30.GiB + 2.MiB }

        it "returns the extra size rounded up to the VG extent size" do
          extra = max - vg_big_pe.size
          # Extent size of vg_big_pe is 64 MiB
          rounding = 62.MiB
          expect(lvm_vg.max_extra_space).to eq(extra + rounding)
        end
      end
    end
  end
end
