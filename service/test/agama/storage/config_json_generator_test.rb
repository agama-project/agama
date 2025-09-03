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

require_relative "./storage_helpers"
require_relative "./product_config_context"
require "agama/storage/config_json_generator"

shared_examples "using partitions" do |section|
  context "if the product uses partitions by default" do
    let(:lvm) { false }

    context "and the space policy is 'delete'" do
      let(:space_policy) { "delete" }

      it "generates the expected JSON" do
        expect(subject.generate).to eq(
          {
            section => [
              {
                search:     device&.name,
                partitions: [
                  { search: "*", delete: true },
                  { generate: "default" }
                ]
              }
            ]
          }
        )
      end
    end

    context "and the space policy is 'resize'" do
      let(:space_policy) { "resize" }

      it "generates the expected JSON" do
        expect(subject.generate).to eq(
          {
            section => [
              {
                search:     device&.name,
                partitions: [
                  { search: "*", size: { min: 0, max: "current" } },
                  { generate: "default" }
                ]
              }
            ]
          }
        )
      end
    end

    context "and the space policy is 'keep'" do
      let(:space_policy) { "keep" }

      it "generates the expected JSON" do
        expect(subject.generate).to eq(
          {
            section => [
              {
                search:     device&.name,
                partitions: [
                  { generate: "default" }
                ]
              }
            ]
          }
        )
      end
    end

    context "and the space policy is unknown" do
      let(:space_policy) { nil }

      it "generates the expected JSON" do
        expect(subject.generate).to eq(
          {
            section => [
              {
                search:     device&.name,
                partitions: [
                  { generate: "default" }
                ]
              }
            ]
          }
        )
      end
    end
  end
end

shared_examples "using lvm" do |section|
  context "if the product uses LVM by default" do
    let(:lvm) { true }

    context "and the space policy is 'delete'" do
      let(:space_policy) { "delete" }

      it "generates the expected JSON" do
        expect(subject.generate).to eq(
          {
            section =>       [
              {
                alias:      "system-target",
                search:     device&.name,
                partitions: [
                  { search: "*", delete: true }
                ]
              }
            ],
            volumeGroups: [
              {
                name:            "system",
                physicalVolumes: [{ generate: ["system-target"] }],
                logicalVolumes:  [{ generate: "default" }]
              }
            ]
          }
        )
      end
    end

    context "and the space policy is 'resize'" do
      let(:space_policy) { "resize" }

      it "generates the expected JSON" do
        expect(subject.generate).to eq(
          {
            section =>       [
              {
                alias:      "system-target",
                search:     device&.name,
                partitions: [
                  { search: "*", size: { min: 0, max: "current" } }
                ]
              }
            ],
            volumeGroups: [
              {
                name:            "system",
                physicalVolumes: [{ generate: ["system-target"] }],
                logicalVolumes:  [{ generate: "default" }]
              }
            ]
          }
        )
      end
    end

    context "and the space policy is 'keep'" do
      let(:space_policy) { "keep" }

      it "generates the expected JSON" do
        expect(subject.generate).to eq(
          {
            section =>       [
              {
                alias:      "system-target",
                search:     device&.name,
                partitions: []
              }
            ],
            volumeGroups: [
              {
                name:            "system",
                physicalVolumes: [{ generate: ["system-target"] }],
                logicalVolumes:  [{ generate: "default" }]
              }
            ]
          }
        )
      end
    end

    context "and the space policy is unknown" do
      let(:space_policy) { nil }

      it "generates the expected JSON" do
        expect(subject.generate).to eq(
          {
            section =>       [
              {
                alias:      "system-target",
                search:     device&.name,
                partitions: []
              }
            ],
            volumeGroups: [
              {
                name:            "system",
                physicalVolumes: [{ generate: ["system-target"] }],
                logicalVolumes:  [{ generate: "default" }]
              }
            ]
          }
        )
      end
    end
  end
end

describe Agama::Storage::ConfigJSONGenerator do
  include Agama::RSpec::StorageHelpers

  include_context "product config"

  subject { described_class.new(product_config, device: device) }

  before do
    mock_storage(devicegraph: scenario)
  end

  describe "#generate" do
    context "if there is a target device" do
      let(:device) { Y2Storage::StorageManager.instance.probed.find_by_name(device_name) }

      context "and the device is a drive" do
        let(:scenario) { "disks.yaml" }
        let(:device_name) { "/dev/vda" }

        include_examples "using partitions", :drives
        include_examples "using lvm", :drives
      end

      context "and the device is a MD RAID" do
        let(:scenario) { "md_raids.yaml" }
        let(:device_name) { "/dev/md0" }

        include_examples "using partitions", :mdRaids
        include_examples "using lvm", :mdRaids
      end
    end

    context "if there is no target device" do
      let(:scenario) { "disks.yaml" }
      let(:device) { nil }

      include_examples "using partitions", :drives
      include_examples "using lvm", :drives
    end
  end
end
