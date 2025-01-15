# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require_relative "../../test_helper"
require "agama/config"
require "agama/storage/config_json_reader"

describe Agama::Storage::ConfigJSONReader do
  let(:product_config) { Agama::Config.new(config_data) }

  subject { described_class.new(product_config) }

  describe "#read" do
    let(:config_data) do
      {
        "storage" => {
          "lvm"              => lvm,
          "space_policy"     => space_policy,
          "encryption"       => {
            "method"        => "luks2",
            "pbkd_function" => "argon2id"
          },
          "volumes"          => ["/", "swap"],
          "volume_templates" => [
            {
              "mount_path" => "/",
              "outline"    => { "required" => true }
            },
            {
              "mount_path" => "/home",
              "outline"    => { "required" => false }
            },
            {
              "mount_path" => "swap",
              "outline"    => { "required" => false }
            }
          ]
        }
      }
    end

    context "if lvm is disabled" do
      let(:lvm) { false }

      context "and the space policy is 'delete'" do
        let(:space_policy) { "delete" }

        it "generates the expected JSON" do
          expect(subject.read).to eq(
            {
              storage: {
                drives: [
                  {
                    partitions: [
                      { search: "*", delete: true },
                      { generate: "default" }
                    ]
                  }
                ]
              }
            }
          )
        end
      end

      context "and the space policy is 'resize'" do
        let(:space_policy) { "resize" }

        it "generates the expected JSON" do
          expect(subject.read).to eq(
            {
              storage: {
                drives: [
                  {
                    partitions: [
                      { search: "*", size: { min: 0, max: "current" } },
                      { generate: "default" }
                    ]
                  }
                ]
              }
            }
          )
        end
      end

      context "and the space policy is 'keep'" do
        let(:space_policy) { "keep" }

        it "generates the expected JSON" do
          expect(subject.read).to eq(
            {
              storage: {
                drives: [
                  {
                    partitions: [
                      { generate: "default" }
                    ]
                  }
                ]
              }
            }
          )
        end
      end

      context "and the space policy is unknown" do
        let(:space_policy) { nil }

        it "generates the expected JSON" do
          expect(subject.read).to eq(
            {
              storage: {
                drives: [
                  {
                    partitions: [
                      { generate: "default" }
                    ]
                  }
                ]
              }
            }
          )
        end
      end
    end

    context "if lvm is enabled" do
      let(:lvm) { true }

      context "and the space policy is 'delete'" do
        let(:space_policy) { "delete" }

        it "generates the expected JSON" do
          expect(subject.read).to eq(
            {
              storage: {
                drives:       [
                  {
                    alias:      "target",
                    partitions: [
                      { search: "*", delete: true }
                    ]
                  }
                ],
                volumeGroups: [
                  {
                    name:            "system",
                    physicalVolumes: [{ generate: ["target"] }],
                    logicalVolumes:  [{ generate: "default" }]
                  }
                ]
              }
            }
          )
        end
      end

      context "and the space policy is 'resize'" do
        let(:space_policy) { "resize" }

        it "generates the expected JSON" do
          expect(subject.read).to eq(
            {
              storage: {
                drives:       [
                  {
                    alias:      "target",
                    partitions: [
                      { search: "*", size: { min: 0, max: "current" } }
                    ]
                  }
                ],
                volumeGroups: [
                  {
                    name:            "system",
                    physicalVolumes: [{ generate: ["target"] }],
                    logicalVolumes:  [{ generate: "default" }]
                  }
                ]
              }
            }
          )
        end
      end

      context "and the space policy is 'keep'" do
        let(:space_policy) { "keep" }

        it "generates the expected JSON" do
          expect(subject.read).to eq(
            {
              storage: {
                drives:       [
                  { alias: "target" }
                ],
                volumeGroups: [
                  {
                    name:            "system",
                    physicalVolumes: [{ generate: ["target"] }],
                    logicalVolumes:  [{ generate: "default" }]
                  }
                ]
              }
            }
          )
        end
      end

      context "and the space policy is 'keep'" do
        let(:space_policy) { nil }

        it "generates the expected JSON" do
          expect(subject.read).to eq(
            {
              storage: {
                drives:       [
                  { alias: "target" }
                ],
                volumeGroups: [
                  {
                    name:            "system",
                    physicalVolumes: [{ generate: ["target"] }],
                    logicalVolumes:  [{ generate: "default" }]
                  }
                ]
              }
            }
          )
        end
      end
    end
  end
end
