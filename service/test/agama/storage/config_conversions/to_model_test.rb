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

require_relative "../config_context"
require "agama/storage/config_conversions/to_model"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

describe Agama::Storage::ConfigConversions::ToModel do
  include_context "config"

  subject { described_class.new(config) }

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
            search:     "/dev/vda",
            partitions: [
              { size: "5 GiB" }
            ]
          }
        ],
        mdRaids:      [
          {
            search:     "/dev/md0",
            filesystem: { path: "/data" }
          }
        ],
        volumeGroups: [
          {
            name:            "test",
            physicalVolumes: [{ generate: ["disk1"] }],
            logicalVolumes:  [
              {
                filesystem: { path: "/" }
              }
            ]
          }
        ]
      }
    end

    before { solve_config }

    it "generates the expected JSON" do
      expect(subject.convert).to eq(
        {
          boot:         {
            configure: true,
            device:    {
              default: false,
              name:    "/dev/vda"
            }
          },
          drives:       [
            {
              name:        "/dev/vda",
              spacePolicy: "keep",
              partitions:  [
                {
                  delete:         false,
                  deleteIfNeeded: false,
                  resize:         false,
                  resizeIfNeeded: false,
                  size:           {
                    default: false,
                    min:     5.GiB.to_i,
                    max:     5.GiB.to_i
                  }
                }
              ]
            }
          ],
          mdRaids:      [
            {
              name:        "/dev/md0",
              filesystem:  {
                reuse:   false,
                default: true,
                type:    "ext4"
              },
              mountPath:   "/data",
              spacePolicy: "keep",
              partitions:  []
            }
          ],
          volumeGroups: [
            {
              vgName:         "test",
              targetDevices:  ["/dev/vda"],
              logicalVolumes: [
                {
                  filesystem: {
                    reuse:   false,
                    default: true,
                    type:    "btrfs"
                  },
                  mountPath:  "/",
                  size:       {
                    default: true,
                    min:     0
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
