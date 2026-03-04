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
require "agama/storage/config_conversions/from_json"
require "agama/storage/config_conversions/to_model_conversions/volume_group"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

describe Agama::Storage::ConfigConversions::ToModelConversions::VolumeGroup do
  subject { described_class.new(volume_group_config, config, volumes) }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSON
      .new(config_json)
      .convert
  end

  let(:volume_group_config) { config.volume_groups.first }

  let(:config_json) do
    {
      drives:       drives,
      volumeGroups: [
        {
          name:            name,
          extentSize:      extent_size,
          physicalVolumes: physical_volumes,
          logicalVolumes:  logical_volumes
        }
      ]
    }
  end

  let(:volumes) { Agama::Storage::VolumeTemplatesBuilder.new([]) }

  let(:drives) { nil }
  let(:name) { nil }
  let(:extent_size) { nil }
  let(:physical_volumes) { nil }
  let(:logical_volumes) { nil }

  describe "#convert" do
    context "if #name is not configured" do
      let(:name) { nil }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json.keys).to_not include(:vgName)
      end
    end

    context "if #extent_size is not configured" do
      let(:extent_size) { nil }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json.keys).to_not include(:extentSize)
      end
    end

    context "if #physical_volumes_devices is not configured" do
      let(:physical_volumes) { nil }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:targetDevices]).to eq([])
      end
    end

    context "if #logical_volumes is not configured" do
      let(:logical_volumes) { nil }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:logicalVolumes]).to eq([])
      end
    end

    context "if #name is configured" do
      let(:name) { "test" }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:vgName]).to eq("test")
      end
    end

    context "if #extent_size is configured" do
      let(:extent_size) { "1 KiB" }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:extentSize]).to eq(1.KiB.to_i)
      end
    end

    context "if #physical_volumes_devices is configured" do
      let(:physical_volumes) { [{ generate: ["disk1", "disk2"] }] }

      let(:drives) do
        [
          { alias: "disk1", search: "/dev/vda" },
          { alias: "disk2", search: "/dev/vdb" }
        ]
      end

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:targetDevices]).to eq(["/dev/vda", "/dev/vdb"])
      end
    end

    context "if #logical_volumes is configured" do
      let(:logical_volumes) do
        [
          { size: "10 GiB" },
          { filesystem: { path: "/" } }
        ]
      end

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:logicalVolumes]).to eq(
          [
            {
              size: {
                default: false,
                min:     10.GiB.to_i,
                max:     10.GiB.to_i
              }
            },
            {
              filesystem: {
                reuse: false
              },
              mountPath:  "/",
              size:       {
                default: true,
                min:     0
              }
            }
          ]
        )
      end
    end
  end
end
