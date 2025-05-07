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
require "agama/storage/config_conversions/from_json_conversions/partition"
require "agama/storage/config_conversions/to_json_conversions/partition"

describe Agama::Storage::ConfigConversions::ToJSONConversions::Partition do
  subject { described_class.new(config) }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSONConversions::Partition
      .new(config_json)
      .convert
  end

  let(:config_json) do
    {
      search:         search,
      alias:          device_alias,
      id:             id,
      size:           size,
      encryption:     encryption,
      filesystem:     filesystem,
      delete:         delete,
      deleteIfNeeded: delete_if_needed
    }
  end

  let(:search) { nil }
  let(:device_alias) { "p1" }
  let(:id) { "linux" }
  let(:size) { nil }
  let(:encryption) { nil }
  let(:filesystem) { nil }
  let(:delete) { nil }
  let(:delete_if_needed) { nil }

  describe "#convert" do
    context "if nothing is configured" do
      let(:device_alias) { nil }
      let(:id) { nil }

      it "returns nil" do
        expect(subject.convert).to be_nil
      end
    end

    include_examples "without search"
    include_examples "without alias"
    include_examples "without size"
    include_examples "without encryption"
    include_examples "without filesystem"

    context "if #id is not configured" do
      let(:id) { nil }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json.keys).to_not include(:id)
      end
    end

    context "if #delete is not configured" do
      let(:delete) { nil }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json.keys).to_not include(:delete)
      end
    end

    context "if #delete_if_needed is not configured" do
      let(:delete_if_needed) { nil }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json.keys).to_not include(:deleteIfNeeded)
      end
    end

    include_examples "with search"
    include_examples "with alias"
    include_examples "with size"
    include_examples "with encryption"
    include_examples "with filesystem"

    context "if #id is configured" do
      let(:id) { "esp" }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:id]).to eq("esp")
      end
    end

    context "if #delete is true" do
      let(:delete) { true }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:delete]).to eq(true)
      end
    end

    context "if #delete_if_needed is true" do
      let(:delete_if_needed) { true }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:deleteIfNeeded]).to eq(true)
      end
    end
  end
end
