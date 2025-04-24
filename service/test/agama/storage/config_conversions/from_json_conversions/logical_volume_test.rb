# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
require_relative "./examples"
require "agama/storage/config_conversions/from_json_conversions/logical_volume"
require "agama/storage/configs/logical_volume"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

describe Agama::Storage::ConfigConversions::FromJSONConversions::LogicalVolume do
  subject do
    described_class.new(logical_volume_json)
  end

  describe "#convert" do
    let(:logical_volume_json) do
      {
        name:       name,
        stripes:    stripes,
        stripeSize: stripe_size,
        pool:       pool,
        usedPool:   used_pool,
        alias:      device_alias,
        size:       size,
        encryption: encryption,
        filesystem: filesystem
      }
    end

    let(:name) { nil }
    let(:stripes) { nil }
    let(:stripe_size) { nil }
    let(:pool) { nil }
    let(:used_pool) { nil }
    let(:device_alias) { nil }
    let(:size) { nil }
    let(:encryption) { nil }
    let(:filesystem) { nil }

    it "returns a logical volume config" do
      logical_volum = subject.convert
      expect(logical_volum).to be_a(Agama::Storage::Configs::LogicalVolume)
    end

    context "if 'name' is not specified" do
      let(:name) { nil }

      it "does not set #name" do
        logical_volume = subject.convert
        expect(logical_volume.name).to be_nil
      end
    end

    context "if 'stripes' is not specified" do
      let(:stripes) { nil }

      it "does not set #stripes" do
        logical_volume = subject.convert
        expect(logical_volume.stripes).to be_nil
      end
    end

    context "if 'stripeSize' is not specified" do
      let(:stripe_size) { nil }

      it "does not set #stripe_size" do
        logical_volume = subject.convert
        expect(logical_volume.stripe_size).to be_nil
      end
    end

    context "if 'pool' is not specified" do
      let(:pool) { nil }

      it "sets #pool? to false" do
        logical_volume = subject.convert
        expect(logical_volume.pool?).to eq(false)
      end
    end

    context "if 'usedPool' is not specified" do
      let(:used_pool) { nil }

      it "does not set #used_pool" do
        logical_volume = subject.convert
        expect(logical_volume.used_pool).to be_nil
      end
    end

    include_examples "without alias"
    include_examples "without size"
    include_examples "without encryption"
    include_examples "without filesystem"

    context "if 'name' is specified" do
      let(:name) { "test" }

      it "sets #name to the expected value" do
        logical_volume = subject.convert
        expect(logical_volume.name).to eq("test")
      end
    end

    context "if 'stripes' is specified" do
      let(:stripes) { 10 }

      it "sets #stripes to the expected value" do
        logical_volume = subject.convert
        expect(logical_volume.stripes).to eq(10)
      end
    end

    context "if 'stripeSize' is specified" do
      context "if 'stripeSize' is a string" do
        let(:stripe_size) { "4 KiB" }

        it "sets #stripe_size to the expected value" do
          logical_volume = subject.convert
          expect(logical_volume.stripe_size).to eq(4.KiB)
        end
      end

      context "if 'stripeSize' is a number" do
        let(:stripe_size) { 4096 }

        it "sets #stripe_size to the expected value" do
          logical_volume = subject.convert
          expect(logical_volume.stripe_size).to eq(4.KiB)
        end
      end
    end

    context "if 'pool' is specified" do
      let(:pool) { true }

      it "sets #pool? to the expected value" do
        logical_volume = subject.convert
        expect(logical_volume.pool?).to eq(true)
      end
    end

    context "if 'usedPool' is specified" do
      let(:used_pool) { "pool" }

      it "sets #used_pool to the expected value" do
        logical_volume = subject.convert
        expect(logical_volume.used_pool).to eq("pool")
      end
    end

    include_examples "with alias"
    include_examples "with size"
    include_examples "with encryption"
    include_examples "with filesystem"
  end
end
