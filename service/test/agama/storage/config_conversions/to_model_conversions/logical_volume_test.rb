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

require_relative "../../storage_helpers"
require_relative "./examples"
require "agama/storage/config_conversions/from_json_conversions/logical_volume"
require "agama/storage/config_conversions/to_model_conversions/logical_volume"
require "agama/storage/volume_templates_builder"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

describe Agama::Storage::ConfigConversions::ToModelConversions::LogicalVolume do
  subject { described_class.new(config, volumes) }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSONConversions::LogicalVolume
      .new(config_json)
      .convert
  end

  let(:config_json) do
    {
      filesystem: filesystem,
      size:       size,
      name:       name,
      stripes:    stripes,
      stripeSize: stripe_size
    }
  end

  let(:volumes) { Agama::Storage::VolumeTemplatesBuilder.new([]) }

  let(:filesystem) { nil }
  let(:size) { nil }
  let(:name) { nil }
  let(:stripes) { nil }
  let(:stripe_size) { nil }

  describe "#convert" do
    context "if #name is not configured" do
      let(:name) { nil }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json.keys).to_not include(:lvName)
      end
    end

    context "if #stripes is not configured" do
      let(:stripes) { nil }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json.keys).to_not include(:stripes)
      end
    end

    context "if #stripe_size is not configured" do
      let(:stripe_size) { nil }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json.keys).to_not include(:stripeSize)
      end
    end

    include_examples "without filesystem"
    include_examples "without size"

    context "if #name is configured" do
      let(:name) { "test" }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:lvName]).to eq("test")
      end
    end

    context "if #stripes is configured" do
      let(:stripes) { 8 }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:stripes]).to eq(8)
      end
    end

    context "if #stripe_size is configured" do
      let(:stripe_size) { "4 KiB" }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:stripeSize]).to eq(4.KiB.to_i)
      end
    end

    include_examples "with filesystem"
    include_examples "with size"
  end
end
