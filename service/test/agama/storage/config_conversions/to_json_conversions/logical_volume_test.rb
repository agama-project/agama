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
require "agama/storage/config_conversions/to_json_conversions/logical_volume"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

describe Agama::Storage::ConfigConversions::ToJSONConversions::LogicalVolume do
  subject { described_class.new(config) }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSONConversions::LogicalVolume
      .new(config_json)
      .convert
  end

  let(:config_json) do
    {
      alias:      device_alias,
      name:       name,
      stripes:    stripes,
      stripeSize: stripe_size,
      pool:       pool,
      usedPool:   used_pool,
      size:       size,
      encryption: encryption,
      filesystem: filesystem
    }
  end

  let(:device_alias) { "test" }
  let(:name) { "lv1" }
  let(:stripes) { nil }
  let(:stripe_size) { nil }
  let(:pool) { nil }
  let(:used_pool) { nil }
  let(:size) { nil }
  let(:encryption) { nil }
  let(:filesystem) { nil }

  describe "#convert" do
    context "if nothing is configured" do
      let(:device_alias) { nil }
      let(:name) { nil }

      it "returns nil" do
        expect(subject.convert).to be_nil
      end
    end

    include_examples "without alias"
    include_examples "without size"
    include_examples "without encryption"
    include_examples "without filesystem"

    context "if #name is not configured" do
      let(:name) { nil }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json.keys).to_not include(:name)
      end
    end

    context "if #stripes is not configured" do
      let(:stripes) { nil }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json.keys).to_not include(:stripes)
      end
    end

    context "if #stripe_size is not configured" do
      let(:stripe_size) { nil }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json.keys).to_not include(:stripeSize)
      end
    end

    context "if #pool is not configured" do
      let(:pool) { nil }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json.keys).to_not include(:pool)
      end
    end

    context "if #used_pool is not configured" do
      let(:used_pool) { nil }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json.keys).to_not include(:usedPool)
      end
    end

    include_examples "with alias"
    include_examples "with size"
    include_examples "with encryption"
    include_examples "with filesystem"

    context "if #stripes is configured" do
      let(:stripes) { 10 }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:stripes]).to eq(10)
      end
    end

    context "if #stripe_size is configured" do
      let(:stripe_size) { "4 KiB" }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:stripeSize]).to eq(4.KiB.to_i)
      end
    end

    context "if #pool is true" do
      let(:pool) { true }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:pool]).to eq(true)
      end
    end

    context "if #used_pool is configured" do
      let(:used_pool) { "pool" }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:usedPool]).to eq("pool")
      end
    end
  end
end
