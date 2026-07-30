# frozen_string_literal: true

# Copyright (c) [2025-2026] SUSE LLC
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
require "agama/storage/config_conversions/from_json_conversions/search"
require "agama/storage/config_conversions/to_json_conversions/search"
require "y2storage/blk_device"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

describe Agama::Storage::ConfigConversions::ToJSONConversions::Search do
  subject { described_class.new(config) }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSONConversions::Search
      .new(config_json)
      .convert
  end

  let(:config_json) do
    {
      condition:  condition,
      sort:       sort,
      ifNotFound: if_not_found,
      max:        max
    }
  end

  let(:condition) { nil }
  let(:if_not_found) { nil }
  let(:max) { nil }
  let(:sort) { nil }

  shared_examples "with device" do
    context "and there is an assigned device" do
      before do
        device = instance_double(Y2Storage::BlkDevice, name: "/dev/vda")
        config.solve(device)
      end

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:condition]).to eq({ name: "/dev/vda" })
      end
    end
  end

  describe "#convert" do
    it "returns a Hash" do
      expect(subject.convert).to be_a(Hash)
    end

    context "if #max is not configured" do
      let(:max) { nil }

      it "generates the expected JSON" do
        expect(subject.convert.keys).to_not include(:max)
      end
    end

    context "if #condition is not configured" do
      let(:condition) { nil }

      context "and there is no assigned device" do
        it "generates the expected JSON" do
          expect(subject.convert.keys).to_not include(:condition)
        end
      end

      include_examples "with device"
    end

    context "if #max is configured" do
      let(:max) { 2 }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:max]).to eq(2)
      end
    end

    context "if #condition is configured to search by name" do
      let(:condition) { { name: "/dev/vda" } }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:condition]).to eq({ name: "/dev/vda" })
      end
    end

    context "if #condition is configured to search by size" do
      let(:condition) do
        { size: { greater: "2 GiB" } }
      end

      context "and there is no assigned device" do
        it "generates the expected JSON" do
          config_json = subject.convert
          expect(config_json[:condition]).to eq({ size: { greater: 2.GiB.to_i } })
        end
      end

      include_examples "with device"
    end

    context "if #condition is configured to search by driver" do
      let(:condition) { { driver: "ahci" } }

      context "and there is no assigned device" do
        it "generates the expected JSON" do
          config_json = subject.convert
          expect(config_json[:condition]).to eq({ driver: "ahci" })
        end
      end

      include_examples "with device"
    end

    context "if #condition is configured to search by transport" do
      let(:condition) { { transport: "usb" } }

      context "and there is no assigned device" do
        it "generates the expected JSON" do
          config_json = subject.convert
          expect(config_json[:condition]).to eq({ transport: "usb" })
        end
      end

      include_examples "with device"
    end

    context "if #condition is configured to search by partition number" do
      let(:condition) { { number: 2 } }

      context "and there is no assigned device" do
        it "generates the expected JSON" do
          config_json = subject.convert
          expect(config_json[:condition]).to eq({ number: 2 })
        end
      end

      include_examples "with device"
    end

    context "if #condition is configured to search by partition id" do
      let(:condition) { { id: "esp" } }

      context "and there is no assigned device" do
        it "generates the expected JSON" do
          config_json = subject.convert
          expect(config_json[:condition]).to eq({ id: "esp" })
        end
      end

      include_examples "with device"
    end

    context "if #condition is configured with an 'and' operator" do
      let(:condition) do
        { and: [{ name: "/dev/vda" }, { size: { less: "1 TiB" } }] }
      end

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:condition]).to eq(
          { and: [{ name: "/dev/vda" }, { size: { less: 1.TiB.to_i } }] }
        )
      end
    end

    context "if #condition is configured with an 'or' operator" do
      let(:condition) do
        { or: [{ number: 1 }, { number: 2 }] }
      end

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:condition]).to eq(
          { or: [{ number: 1 }, { number: 2 }] }
        )
      end
    end

    context "if #condition is configured with a 'not' operator" do
      let(:condition) { { not: { name: "/dev/vda" } } }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:condition]).to eq({ not: { name: "/dev/vda" } })
      end
    end

    context "if #condition is configured to search by filesystem presence" do
      context "with the 'any' shortcut" do
        let(:condition) { { filesystem: "any" } }

        it "generates the expected JSON" do
          config_json = subject.convert
          expect(config_json[:condition]).to eq({ filesystem: "any" })
        end
      end

      context "with the 'none' shortcut" do
        let(:condition) { { filesystem: "none" } }

        it "generates the expected JSON" do
          config_json = subject.convert
          expect(config_json[:condition]).to eq({ filesystem: "none" })
        end
      end
    end

    context "if #condition is configured to search by filesystem type" do
      let(:condition) { { filesystem: { type: "ext4" } } }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:condition]).to eq({ filesystem: { type: "ext4" } })
      end
    end

    context "if #condition is configured to search by filesystem label" do
      let(:condition) { { filesystem: { label: "data" } } }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:condition]).to eq({ filesystem: { label: "data" } })
      end
    end

    context "if #condition is configured with a filesystem operator" do
      let(:condition) do
        { filesystem: { and: [{ type: "btrfs" }, { not: { label: "root" } }] } }
      end

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:condition]).to eq(
          { filesystem: { and: [{ type: "btrfs" }, { not: { label: "root" } }] } }
        )
      end
    end

    context "if #condition is configured with partitions presence 'any'" do
      let(:condition) { { partitions: "any" } }

      it "generates the expected JSON" do
        expect(subject.convert[:condition]).to eq({ partitions: "any" })
      end
    end

    context "if #condition is configured with partitions presence 'none'" do
      let(:condition) { { partitions: "none" } }

      it "generates the expected JSON" do
        expect(subject.convert[:condition]).to eq({ partitions: "none" })
      end
    end

    context "if #condition is configured with a partitions 'any' quantifier" do
      let(:condition) { { partitions: { any: { size: { greater: "2 GiB" } } } } }

      it "generates the expected JSON" do
        expect(subject.convert[:condition]).to eq(
          { partitions: { any: { size: { greater: 2.GiB.to_i } } } }
        )
      end
    end

    context "if #condition is configured with a partitions 'all' quantifier" do
      let(:condition) { { partitions: { all: { filesystem: { type: "ext4" } } } } }

      it "generates the expected JSON" do
        expect(subject.convert[:condition]).to eq(
          { partitions: { all: { filesystem: { type: "ext4" } } } }
        )
      end
    end

    context "if #condition is configured with a partitions 'count' (min only)" do
      let(:condition) { { partitions: { count: { min: 2 } } } }

      it "generates the expected JSON" do
        expect(subject.convert[:condition]).to eq({ partitions: { count: { min: 2 } } })
      end
    end

    context "if #condition is configured with a partitions 'count' (condition, min, max)" do
      let(:condition) do
        { partitions: { count: { condition: { size: { greater: "10 GiB" } }, min: 2, max: 5 } } }
      end

      it "generates the expected JSON" do
        expect(subject.convert[:condition]).to eq(
          {
            partitions: {
              count: { condition: { size: { greater: 10.GiB.to_i } }, min: 2, max: 5 }
            }
          }
        )
      end
    end

    context "if #condition is configured with a partitions quantifier with an id condition" do
      let(:condition) { { partitions: { any: { id: "esp" } } } }

      it "generates the expected JSON" do
        expect(subject.convert[:condition]).to eq({ partitions: { any: { id: "esp" } } })
      end
    end

    context "if #condition is configured with operators over driver and transport" do
      let(:condition) do
        {
          and: [
            { not: { transport: "usb" } },
            { driver: "sd" }
          ]
        }
      end

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:condition]).to eq(
          {
            and: [
              { not: { transport: "usb" } },
              { driver: "sd" }
            ]
          }
        )
      end
    end

    context "if #condition is configured with nested operators" do
      let(:condition) do
        {
          and: [
            { size: { less: "1 TiB" } },
            { not: { name: "/dev/vda" } }
          ]
        }
      end

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:condition]).to eq(
          {
            and: [
              { size: { less: 1.TiB.to_i } },
              { not: { name: "/dev/vda" } }
            ]
          }
        )
      end
    end

    context "if #if_not_found is configured" do
      let(:if_not_found) { "skip" }

      it "generates the expected JSON" do
        expect(subject.convert[:ifNotFound]).to eq("skip")
      end
    end

    context "if #sort is configured with a single criterion" do
      let(:sort) { "name" }

      it "generates a JSON with a fully defined list of sort criteria" do
        config_json = subject.convert
        expect(config_json[:sort]).to eq [{ name: "asc" }]
      end
    end

    context "if #sort is configured with complex criteria" do
      let(:sort) { ["size", { name: "desc" }] }

      it "generates a JSON with a fully defined list of sort criteria" do
        config_json = subject.convert
        expect(config_json[:sort]).to eq [{ size: "asc" }, { name: "desc" }]
      end
    end
  end
end
