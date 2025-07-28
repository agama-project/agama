# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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

require_relative "../../../test_helper"
require "agama/storage/config_conversions/from_json"
require "agama/storage/config_conversions/to_json"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

describe Agama::Storage::ConfigConversions::ToJSON do
  subject { described_class.new(config) }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSON
      .new(config_json)
      .convert
  end

  describe "#convert" do
    let(:config_json) do
      {
        boot:         {
          configure: true,
          device:    "disk1"
        },
        drives:       [
          {
            alias:      "disk1",
            partitions: [
              {
                alias: "p1",
                size:  "5 GiB"
              },
              {
                alias: "p2",
                size:  "10 GiB"
              },
              {
                alias: "p3",
                size:  "10 GiB"
              }
            ]
          }
        ],
        mdRaids:      [
          {
            level:   "raid0",
            devices: ["p2", "p3"]
          }
        ],
        volumeGroups: [
          {
            name:            "test",
            physicalVolumes: ["p1"],
            logicalVolumes:  [
              {
                filesystem: { path: "/" }
              }
            ]
          }
        ]
      }
    end

    it "generates the expected JSON" do
      config_json = subject.convert
      expect(config_json).to eq(
        {
          boot:         {
            configure: true,
            device:    "disk1"
          },
          drives:       [
            {
              search:     {
                ifNotFound: "error",
                max:        1
              },
              alias:      "disk1",
              partitions: [
                {
                  alias: "p1",
                  size:  {
                    min: 5.GiB.to_i,
                    max: 5.GiB.to_i
                  }
                },
                {
                  alias: "p2",
                  size:  {
                    min: 10.GiB.to_i,
                    max: 10.GiB.to_i
                  }
                },
                {
                  alias: "p3",
                  size:  {
                    min: 10.GiB.to_i,
                    max: 10.GiB.to_i
                  }
                }
              ]
            }
          ],
          mdRaids:      [
            {
              level:   "raid0",
              devices: ["p2", "p3"]
            }
          ],
          volumeGroups: [
            {
              name:            "test",
              physicalVolumes: ["p1"],
              logicalVolumes:  [
                {
                  filesystem: {
                    mkfsOptions:     [],
                    mountOptions:    [],
                    path:            "/",
                    reuseIfPossible: false
                  }
                }
              ]
            }
          ]
        }
      )
    end
  end
end
