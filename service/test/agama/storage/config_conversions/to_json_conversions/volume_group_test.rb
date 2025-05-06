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
require "agama/storage/config_conversions/from_json_conversions/volume_group"
require "agama/storage/config_conversions/to_json_conversions/volume_group"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

describe Agama::Storage::ConfigConversions::ToJSONConversions::VolumeGroup do
  subject { described_class.new(config) }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSONConversions::VolumeGroup
      .new(config_json)
      .convert
  end

  let(:config_json) do
    {
      name:            name,
      extentSize:      extent_size,
      physicalVolumes: physical_volumes,
      logicalVolumes:  logical_volumes
    }
  end

  let(:name) { nil }
  let(:extent_size) { nil }
  let(:physical_volumes) { nil }
  let(:logical_volumes) { nil }

  describe "#convert" do
    it "returns a Hash" do
      expect(subject.convert).to be_a(Hash)
    end

    context "if #name is not configured" do
      let(:name) { nil }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json.keys).to_not include(:name)
      end
    end

    context "if #extent_size is not configured" do
      let(:extent_size) { nil }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json.keys).to_not include(:extentSize)
      end
    end

    context "if #physical_volumes is not configured" do
      let(:physical_volumes) { nil }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:physicalVolumes]).to eq([])
      end
    end

    context "if #logical_volumes is not configured" do
      let(:logical_volumes) { nil }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:logicalVolumes]).to eq([])
      end
    end

    context "if #name is configured" do
      let(:name) { "test" }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:name]).to eq("test")
      end
    end

    context "if #extent_size is configured" do
      let(:extent_size) { "4 KiB" }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:extentSize]).to eq(4.KiB.to_i)
      end
    end

    context "if #physical_volumes is configured" do
      let(:physical_volumes) { ["pv1", "pv2"] }

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:physicalVolumes]).to eq(["pv1", "pv2"])
      end

      context "and #physical_volumes_devices is configured" do
        let(:physical_volumes) do
          [
            "pv1",
            "pv2",
            {
              generate: {
                targetDevices: ["disk1"]
              }
            }
          ]
        end

        it "generates the expected JSON" do
          config_json = subject.convert
          expect(config_json[:physicalVolumes]).to eq(
            [
              "pv1",
              "pv2",
              { generate: ["disk1"] }
            ]
          )
        end

        context "and #physical_volumes_encryption is configured" do
          let(:physical_volumes) do
            [
              "pv1",
              "pv2",
              {
                generate: {
                  targetDevices: ["disk1"],
                  encryption:    {
                    luks1: { password: "12345" }
                  }
                }
              }
            ]
          end

          it "generates the expected JSON" do
            config_json = subject.convert
            expect(config_json[:physicalVolumes]).to eq(
              [
                "pv1",
                "pv2",
                {
                  generate: {
                    targetDevices: ["disk1"],
                    encryption:    {
                      luks1: { password: "12345" }
                    }
                  }
                }
              ]
            )
          end
        end
      end
    end

    context "if #logical_volumes is configured" do
      let(:logical_volumes) do
        [
          { name: "lv1" },
          { name: "lv2" }
        ]
      end

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:logicalVolumes]).to eq(
          [
            { name: "lv1" },
            { name: "lv2" }
          ]
        )
      end
    end
  end
end
