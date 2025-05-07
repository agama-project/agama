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
require "agama/storage/config_conversions/from_json_conversions/md_raid"
require "agama/storage/config_conversions/to_json_conversions/md_raid"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

describe Agama::Storage::ConfigConversions::ToJSONConversions::MdRaid do
  subject { described_class.new(config) }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSONConversions::MdRaid
      .new(config_json)
      .convert
  end

  let(:config_json) do
    {
      search:     search,
      alias:      device_alias,
      name:       name,
      level:      level,
      parity:     parity,
      chunkSize:  chunk_size,
      devices:    devices,
      encryption: encryption,
      filesystem: filesystem,
      ptableType: ptable_type,
      partitions: partitions
    }
  end

  let(:search) { nil }
  let(:device_alias) { nil }
  let(:name) { nil }
  let(:level) { nil }
  let(:parity) { nil }
  let(:chunk_size) { nil }
  let(:devices) { nil }
  let(:encryption) { nil }
  let(:filesystem) { nil }
  let(:ptable_type) { nil }
  let(:partitions) { nil }

  describe "#convert" do
    it "returns a Hash" do
      expect(subject.convert).to be_a(Hash)
    end

    include_examples "without search"
    include_examples "without alias"
    include_examples "without encryption"
    include_examples "without filesystem"
    include_examples "without ptable_type"
    include_examples "without partitions"

    context "if #name is not configured" do
      let(:name) { nil }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json.keys).to_not include(:name)
      end
    end

    context "if #level is not configured" do
      let(:level) { nil }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json.keys).to_not include(:level)
      end
    end

    context "if #parity is not configured" do
      let(:parity) { nil }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json.keys).to_not include(:parity)
      end
    end

    context "if #chunk_size is not configured" do
      let(:chunk_size) { nil }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json.keys).to_not include(:chunk_size)
      end
    end

    context "if #devices is not configured" do
      let(:devices) { nil }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:devices]).to eq([])
      end
    end

    include_examples "with search"
    include_examples "with alias"
    include_examples "with encryption"
    include_examples "with filesystem"
    include_examples "with ptable_type"
    include_examples "with partitions"

    context "if #name is configured" do
      let(:name) { "system" }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:name]).to eq("system")
      end
    end

    context "if #level is configured" do
      let(:level) { "raid0" }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:level]).to eq("raid0")
      end
    end

    context "if #parity is configured" do
      let(:parity) { "left_asymmetric" }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:parity]).to eq("left_asymmetric")
      end
    end

    context "if #chunk_size is configured" do
      let(:chunk_size) { "4 KiB" }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:chunkSize]).to eq(4.KiB.to_i)
      end
    end

    context "if #devices is configured" do
      let(:devices) { ["disk1", "disk2"] }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:devices]).to eq(["disk1", "disk2"])
      end
    end
  end
end
