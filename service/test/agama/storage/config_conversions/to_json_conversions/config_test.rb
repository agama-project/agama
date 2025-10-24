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
require "agama/storage/config_conversions/from_json_conversions/config"
require "agama/storage/config_conversions/to_json_conversions/config"

describe Agama::Storage::ConfigConversions::ToJSONConversions::Config do
  subject { described_class.new(config) }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSONConversions::Config
      .new(config_json)
      .convert
  end

  let(:config_json) do
    {
      boot:         boot,
      drives:       drives,
      mdRaids:      md_raids,
      volumeGroups: volume_groups
    }
  end

  let(:boot) { nil }
  let(:drives) { nil }
  let(:md_raids) { nil }
  let(:volume_groups) { nil }

  describe "#convert" do
    context "if nothing is configured" do
      it "generates the expected JSON" do
        expect(subject.convert).to eq(
          {
            boot:         {
              configure: true
            },
            drives:       [],
            mdRaids:      [],
            volumeGroups: []
          }
        )
      end
    end

    context "if #boot is configured" do
      let(:boot) do
        {
          configure: true,
          device:    "vda"
        }
      end

      it "generates the expected JSON" do
        config_json = subject.convert

        expect(config_json[:boot]).to eq(
          {
            configure: true,
            device:    "vda"
          }
        )
      end
    end

    context "if #drives is configured" do
      let(:drives) do
        [
          { search: "/dev/vda" },
          {
            filesystem: { path: "/" }
          }
        ]
      end

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:drives]).to eq(
          [
            {
              search: {
                condition:  { name: "/dev/vda" },
                ifNotFound: "error"
              }
            },
            {
              search:     {
                ifNotFound: "error",
                max:        1
              },
              filesystem: {
                mkfsOptions:     [],
                mountOptions:    [],
                path:            "/",
                reuseIfPossible: false
              }
            }
          ]
        )
      end
    end

    context "if #md_raids is configured" do
      let(:md_raids) do
        [
          {
            level:   "raid1",
            devices: ["disk1", "disk2"]
          }
        ]
      end

      it "generates the expected JSON" do
        config_json = subject.convert
        expect(config_json[:mdRaids]).to eq(
          [
            {
              level:   "raid1",
              devices: ["disk1", "disk2"]
            }
          ]
        )
      end
    end

    context "if #volume_groups is configured" do
      let(:volume_groups) do
        [
          { name: "vg1" },
          { name: "vg2" }
        ]
      end

      it "generates the expected JSON" do
        config_json = subject.convert

        expect(config_json[:volumeGroups]).to eq(
          [
            {
              name:            "vg1",
              physicalVolumes: [],
              logicalVolumes:  []
            },
            {
              name:            "vg2",
              physicalVolumes: [],
              logicalVolumes:  []
            }
          ]
        )
      end
    end
  end
end
