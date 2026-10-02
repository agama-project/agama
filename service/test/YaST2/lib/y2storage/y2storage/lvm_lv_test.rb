#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2018-2021] SUSE LLC
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

describe Y2Storage::LvmLv do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  before do
    fake_scenario(scenario)
  end

  subject(:lv) { fake_devicegraph.find_by_name(device_name) }

  let(:scenario) { "lvm-types1.xml" }

  describe "#is?" do
    before do
      vg = Y2Storage::LvmVg.find_by_vg_name(fake_devicegraph, "vg0")
      vg.create_lvm_lv("writecache", Y2Storage::LvType::WRITECACHE, 1.GiB)
      vg.create_lvm_lv("mirror", Y2Storage::LvType::MIRROR, 1.GiB)
    end

    let(:device_name) { "/dev/vg0/normal1" }

    it "returns true for values whose symbol is :lvm_lv" do
      expect(subject.is?(:lvm_lv)).to eq true
      expect(subject.is?("lvm_lv")).to eq true
    end

    context "if it is a cache pool volume" do
      let(:device_name) { "/dev/vg0/unused_cache_pool" }

      it "returns true for values whose symbol is :lvm_cache_pool" do
        expect(subject.is?(:lvm_cache_pool)).to eq true
        expect(subject.is?("lvm_cache_pool")).to eq true
      end
    end

    context "if it is a cache volume" do
      let(:device_name) { "/dev/vg0/cached1" }

      it "returns true for values whose symbol is :lvm_cache" do
        expect(subject.is?(:lvm_cache)).to eq true
        expect(subject.is?("lvm_cache")).to eq true
      end
    end

    context "if it is a thin pool volume" do
      let(:device_name) { "/dev/vg0/thinpool0" }

      it "returns true for values whose symbol is :lvm_thin_pool" do
        expect(subject.is?(:lvm_thin_pool)).to eq true
        expect(subject.is?("lvm_thin_pool")).to eq true
      end
    end

    context "if it is a thin volume" do
      let(:device_name) { "/dev/vg0/thinvol1" }

      it "returns true for values whose symbol is :lvm_thin" do
        expect(subject.is?(:lvm_thin)).to eq true
        expect(subject.is?("lvm_thin")).to eq true
      end
    end

    context "if it is an non-thin snapshot volume" do
      let(:device_name) { "/dev/vg0/snap_normal1" }

      it "returns true for values whose symbol is :lvm_snapshot" do
        expect(subject.is?(:lvm_snapshot)).to eq true
        expect(subject.is?("lvm_snapshot")).to eq true
      end

      it "returns false for values whose symbol is :lvm_thin_snapshot" do
        expect(subject.is?(:lvm_thin_snapshot)).to eq false
        expect(subject.is?("lvm_thin_snapshot")).to eq false
      end

      it "returns false for values whose symbol is :lvm_thin" do
        expect(subject.is?(:lvm_thin)).to eq false
        expect(subject.is?("lvm_thin")).to eq false
      end
    end

    context "if it is an thin snapshot volume" do
      let(:device_name) { "/dev/vg0/thin_snap_normal2" }

      it "returns true for values whose symbol is :lvm_snapshot" do
        expect(subject.is?(:lvm_snapshot)).to eq true
        expect(subject.is?("lvm_snapshot")).to eq true
      end

      it "returns true for values whose symbol is :lvm_thin_snapshot" do
        expect(subject.is?(:lvm_thin_snapshot)).to eq true
        expect(subject.is?("lvm_thin_snapshot")).to eq true
      end

      it "returns true for values whose symbol is :lvm_thin" do
        expect(subject.is?(:lvm_thin)).to eq true
        expect(subject.is?("lvm_thin")).to eq true
      end
    end

    context "if it is a writecache volume" do
      let(:device_name) { "/dev/vg0/writecache" }

      it "returns true for values whose symbol is :lvm_writecache" do
        expect(subject.is?(:lvm_writecache)).to eq true
        expect(subject.is?("lvm_writecache")).to eq true
      end
    end

    context "if it is a mirror volume" do
      let(:device_name) { "/dev/vg0/mirror" }

      it "returns true for values whose symbol is :lvm_mirror" do
        expect(subject.is?(:lvm_mirror)).to eq true
        expect(subject.is?("lvm_mirror")).to eq true
      end
    end
  end

  describe "#thin_pool" do
    context "when volume is a thin LV" do
      let(:thin_pool) { fake_devicegraph.find_by_name("/dev/vg0/thinpool0") }
      let(:device_name) { "/dev/vg0/thinvol1" }

      it "returns the thin pool the volume belongs to" do
        expect(subject.thin_pool).to eq(thin_pool)
      end
    end

    context "when volume is not a thin LV" do
      let(:device_name) { "/dev/vg0/normal1" }

      it "returns nil" do
        expect(subject.thin_pool).to be_nil
      end
    end
  end

  describe "#stripes" do
    context "when volume is a thin LV" do
      let(:thin_pool) { fake_devicegraph.find_by_name("/dev/vg0/thinpool0") }
      let(:device_name) { "/dev/vg0/thinvol1" }

      it "returns the stripes defined by its thin pool" do
        expect(subject.stripes).to eq(thin_pool.stripes)
      end
    end

    context "when volume is not a thin LV" do
      let(:device_name) { "/dev/vg0/striped1" }

      it "returns its stripping value" do
        expect(subject.stripes).to eq(2)
      end
    end
  end

  describe "#stripe_size" do
    context "when volume is a thin LV" do
      let(:thin_pool) { fake_devicegraph.find_by_name("/dev/vg0/thinpool0") }
      let(:device_name) { "/dev/vg0/thinvol1" }

      it "returns the stripe size defined by its thin pool" do
        expect(subject.stripe_size).to eq(thin_pool.stripe_size)
      end
    end

    context "when volume is not a thin LV" do
      let(:device_name) { "/dev/vg0/striped1" }

      it "returns its stripping value" do
        expect(subject.stripe_size).to eq(4.KiB)
      end
    end
  end

  describe "#striped?" do
    context "when the volume has stripes" do
      let(:device_name) { "/dev/vg0/striped1" }

      it "returns true" do
        expect(subject.striped?).to eq(true)
      end
    end

    context "when the volume has no stripes" do
      let(:device_name) { "/dev/vg0/normal1" }

      it "returns false" do
        expect(subject.striped?).to eq(false)
      end
    end
  end

  describe "#origin" do
    context "when called over a snapshot volume" do
      let(:original_volume) { fake_devicegraph.find_by_name("/dev/vg0/normal1") }
      let(:device_name) { "/dev/vg0/snap_normal1" }

      it "returns the original volume" do
        expect(subject.origin).to eq(original_volume)
      end
    end

    context "when called over a thin volume" do
      context "which is being used as an snapshot" do
        let(:original_volume) { fake_devicegraph.find_by_name("/dev/vg0/normal2") }
        let(:device_name) { "/dev/vg0/thin_snap_normal2" }

        it "returns the original volume" do
          expect(subject.origin).to eq(original_volume)
        end
      end

      context "which is not being used as an snapshot" do
        let(:device_name) { "/dev/vg0/thinvol1" }

        it "returns nil" do
          expect(subject.origin).to be_nil
        end
      end
    end

    context "when called over a not snapshot volume" do
      let(:device_name) { "/dev/vg0/striped2" }

      it "returns nil" do
        expect(subject.origin).to be_nil
      end
    end
  end

  describe "#snapshots" do
    context "when called over a logical volume with snapshots" do
      let(:snapshot) { fake_devicegraph.find_by_name("/dev/vg0/snap_normal1") }
      let(:device_name) { "/dev/vg0/normal1" }

      it "returns a collection holding the snapshots volumes" do
        expect(subject.snapshots).to eq([snapshot])
      end
    end

    context "when called over a logical volume without snapshots" do
      let(:device_name) { "/dev/vg0/normal3" }

      it "returns an empty collection" do
        expect(subject.snapshots).to eq([])
      end
    end
  end

  describe "#overcommitted?" do
    let(:scenario) { "complex-lvm-encrypt" }
    before do
      vg = Y2Storage::LvmVg.find_by_vg_name(fake_devicegraph, "vg1")
      pool = vg.create_lvm_lv("pool", Y2Storage::LvType::THIN_POOL, pool_size)
      pool.create_lvm_lv("thin", Y2Storage::LvType::THIN, thin_size)
    end

    let(:pool_size) { 1.GiB }
    let(:thin_size) { 1.GiB }

    context "if the volume is a normal logical volume" do
      let(:device_name) { "/dev/vg0/lv1" }

      it "returns false" do
        expect(subject.overcommitted?).to eq(false)
      end
    end

    context "if the volume is a thin logical volume" do
      let(:device_name) { "/dev/vg1/thin" }

      it "returns false" do
        expect(subject.overcommitted?).to eq(false)
      end
    end

    context "if the volume is a thin pool" do
      let(:device_name) { "/dev/vg1/pool" }

      context "and the pool is not overcommitted" do
        let(:pool_size) { 1.GiB }

        let(:thin_size) { 500.MiB }

        it "returns false" do
          expect(subject.overcommitted?).to eq(false)
        end
      end

      context "and the pool is overcommitted" do
        let(:pool_size) { 1.GiB }

        let(:thin_size) { 2.GiB }

        it "returns true" do
          expect(subject.overcommitted?).to eq(true)
        end
      end
    end
  end

  describe "#resize" do
    let(:scenario) { "complex-lvm-encrypt" }

    before do
      allow(lv).to receive(:detect_resize_info).and_return resize_info

      lv.stripes = stripes
    end

    let(:resize_info) do
      double(Y2Storage::ResizeInfo, resize_ok?: ok,
        min_size: min, max_size: max,
        reasons: 0, reason_texts: [])
    end
    let(:ok) { true }
    let(:min) { 1.GiB }
    let(:max) { 5.GiB }

    let(:device_name) { "/dev/vg0/lv1" }

    let(:extent_size) { lv.lvm_vg.extent_size }

    let(:stripes) { 1 }

    let(:lv_extents) { lv.size.to_i / extent_size.to_i }

    context "if the volume cannot be resized" do
      let(:ok) { false }

      it "does not modify the volume" do
        initial_size = lv.size
        lv.resize(4.5.GiB)
        expect(lv.size).to eq initial_size
      end
    end

    context "if the new size is bigger than the max resizing size" do
      let(:new_size) { 10.GiB }

      context "and the volume is not a striped volume" do
        let(:stripes) { 1 }

        it "sets the size of the volume to the max" do
          lv.resize(new_size)
          expect(lv.size).to eq max
        end
      end

      context "and the volume is a striped volume" do
        let(:stripes) { 2 }

        context "and the max number of extents is divisible by the number of stripes" do
          let(:max) { extent_size * (5.GiB.to_i / extent_size.to_i) * stripes }

          it "sets the size of the volume to the max" do
            lv.resize(new_size)

            expect(lv.size).to eq max
          end
        end

        context "and the max number of extents is not divisible by the number of stripes" do
          let(:max) { (extent_size * (5.GiB.to_i / extent_size.to_i) * stripes) + extent_size }

          it "sets a number of extents divisible by the number of stripes" do
            lv.resize(new_size)

            expect(lv_extents % lv.stripes).to eq(0)
          end

          it "sets the size to a value smaller than the max value" do
            lv.resize(new_size)

            expect(lv.size).to be < max
          end

          it "sets the size to the closest possible value to the max" do
            lv.resize(new_size)

            expect(max - lv.size).to be < extent_size * stripes
          end
        end
      end
    end

    context "if the new size is smaller than the min resizing size" do
      let(:new_size) { 0.5.GiB }

      context "and the volume is not a striped volume" do
        let(:stripes) { 1 }

        it "sets the size of the volume to the min" do
          lv.resize(new_size)
          expect(lv.size).to eq min
        end
      end

      context "and the volume is a striped volume" do
        let(:stripes) { 2 }

        context "and the min number of extents is divisible by the number of stripes" do
          let(:min) { extent_size * (1.GiB.to_i / extent_size.to_i) * stripes }

          it "sets the size of the volume to the min" do
            lv.resize(new_size)
            expect(lv.size).to eq min
          end
        end

        context "and the min number of extents is not divisible by the number of stripes" do
          let(:min) { (extent_size * (1.GiB.to_i / extent_size.to_i) * stripes) + extent_size }

          it "sets the size of the volume to the min" do
            lv.resize(new_size)
            expect(lv.size).to eq min
          end

          it "does not round the size according the number of stripes" do
            lv.resize(new_size)

            expect(lv_extents % lv.stripes).to_not eq(0)
          end
        end
      end
    end

    context "if the new size is within the resizing limits" do
      context "and the volume is not a striped volume" do
        let(:stripes) { 1 }

        context "and the new size is divisible by the extent size" do
          let(:new_size) { 2.5.GiB }

          it "sets the size of the volume to the requested size" do
            lv.resize(new_size)
            expect(lv.size).to eq new_size
          end
        end

        context "and the new size is not divisible by the extent size" do
          let(:new_size) { 2.5.GiB - 1.MiB }

          it "sets the size to a value divisible by the extent size" do
            expect(new_size.to_i.to_f % extent_size.to_i).to_not be_zero
            expect(lv.size.to_i.to_f % extent_size.to_i).to be_zero
          end

          it "sets the size to a value smaller than the requested size" do
            lv.resize(new_size)
            expect(lv.size).to be < new_size
          end

          it "sets the size to closest possible value" do
            lv.resize(new_size)
            expect(new_size - lv.size).to be < extent_size
          end
        end
      end

      context "and the volume is a striped volume" do
        let(:stripes) { 3 }

        let(:new_size) { 2.5.GiB - 1.MiB }

        it "sets the size to a value divisible by the extent size" do
          lv.resize(new_size)

          expect(lv.size.to_i % extent_size.to_i).to eq(0)
        end

        it "sets a number of extents divisible by the number of stripes" do
          lv.resize(new_size)

          expect(lv_extents % lv.stripes).to eq(0)
        end

        it "sets the size to a value smaller than the requested size" do
          lv.resize(new_size)

          expect(lv.size).to be < new_size
        end

        it "sets the size to the closest possible value" do
          lv.resize(new_size)

          expect(new_size - lv.size).to be < extent_size * stripes
        end
      end
    end
  end

  describe "#rounded_size" do
    let(:scenario) { "complex-lvm-encrypt" }

    let(:device_name) { "/dev/vg0/lv1" }

    before do
      lv.stripes = stripes
      lv.size = size
    end

    let(:extent_size) { lv.lvm_vg.extent_size }

    let(:lv_extents) { lv.size.to_i / extent_size.to_i }

    let(:lv_rounded_extents) { lv.rounded_size.to_i / extent_size.to_i }

    context "if the volume is not a striped volume" do
      let(:stripes) { 1 }

      let(:size) { extent_size * 3 }

      it "returns its current size" do
        expect(lv.rounded_size).to eq(lv.size)
      end
    end

    context "if the volume is a striped volume" do
      let(:stripes) { 2 }

      context "and its number of extents is divible by the number of stripes" do
        let(:size) { extent_size * 100 * stripes }

        it "returns its current size" do
          expect(lv.rounded_size).to eq(lv.size)
        end
      end

      context "and its number of extents is not divible by the number of stripes" do
        let(:size) { (extent_size * 100 * stripes) + extent_size }

        it "returns a number of extents divisible by the number of stripes" do
          expect(lv_extents % lv.stripes).to_not eq(0)
          expect(lv_rounded_extents % lv.stripes).to eq(0)
        end

        it "returns a size smaller than the current size" do
          expect(lv.rounded_size).to be < lv.size
        end

        it "returns the closest possible size" do
          expect(lv.size - lv.rounded_size).to be < extent_size * stripes
        end
      end
    end
  end
end
