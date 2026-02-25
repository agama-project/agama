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

require_relative "../../config_context"
require "agama/storage/config_conversions/to_model_conversions/config"

describe Agama::Storage::ConfigConversions::ToModelConversions::Config do
  include_context "config"

  subject { described_class.new(config, product_config) }

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
    context "if #drives is not configured" do
      let(:drives) { nil }

      it "generates the expected JSON" do
        config_model = subject.convert
        expect(config_model[:drives]).to eq([])
      end
    end

    context "if #volume_groups is not configured" do
      let(:volume_groups) { nil }

      it "generates the expected JSON" do
        config_model = subject.convert
        expect(config_model[:volumeGroups]).to eq([])
      end
    end

    context "if #drives is configured" do
      let(:drives) do
        [
          {
            search:     "/dev/vda",
            partitions: [
              {
                filesystem: { path: "/" }
              }
            ]
          },
          {
            search:     {
              condition:  { name: "/dev/vdz" },
              ifNotFound: "skip"
            },
            partitions: []
          }
        ]
      end

      before { solve_config }

      it "generates the expected JSON" do
        config_model = subject.convert
        expect(config_model[:drives]).to eq(
          [
            {
              name:        "/dev/vda",
              spacePolicy: "keep",
              partitions:  [
                {
                  delete:         false,
                  deleteIfNeeded: false,
                  resize:         false,
                  resizeIfNeeded: false,
                  filesystem:     {
                    reuse:   false,
                    default: true,
                    type:    "btrfs"
                  },
                  mountPath:      "/",
                  size:           {
                    default: true,
                    min:     0
                  }
                }
              ]
            }
          ]
        )
      end
    end

    context "if #md_raids is configured" do
      let(:scenario) { "md_raids.yaml" }

      let(:md_raids) do
        [
          {
            search:     "/dev/md0",
            partitions: [
              {
                filesystem: { path: "/" }
              }
            ]
          },
          {
            search:     {
              condition:  { name: "/dev/md10" },
              ifNotFound: "skip"
            },
            partitions: []
          }
        ]
      end

      before { solve_config }

      it "generates the expected JSON" do
        config_model = subject.convert
        expect(config_model[:mdRaids]).to eq(
          [
            {
              name:        "/dev/md0",
              spacePolicy: "keep",
              partitions:  [
                {
                  delete:         false,
                  deleteIfNeeded: false,
                  resize:         false,
                  resizeIfNeeded: false,
                  filesystem:     {
                    reuse:   false,
                    default: true,
                    type:    "btrfs"
                  },
                  mountPath:      "/",
                  size:           {
                    default: true,
                    min:     0
                  }
                }
              ]
            }
          ]
        )
      end
    end

    context "if #volume_groups is configured" do
      let(:volume_groups) do
        [
          {
            name:           "vg0",
            logicalVolumes: [
              {
                filesystem: { path: "/" }
              }
            ]
          }
        ]
      end

      it "generates the expected JSON" do
        config_model = subject.convert
        expect(config_model[:volumeGroups]).to eq(
          [
            {
              vgName:         "vg0",
              targetDevices:  [],
              logicalVolumes: [
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
            }
          ]
        )
      end
    end

    context "for the 'boot' property" do
      let(:boot) { { configure: true } }

      it "generates the expected JSON" do
        model_json = subject.convert
        expect(model_json[:boot]).to eq(
          {
            configure: true,
            device:    { default: true }
          }
        )
      end
    end

    context "for the 'encryption' property" do
      context "if the root partition is encrypted" do
        let(:config_json) do
          {
            drives:       [
              {
                alias:      "vda",
                partitions: [
                  {
                    filesystem: { path: "/" },
                    encryption: {
                      luks1: { password: "12345" }
                    }
                  }
                ]
              }
            ],
            volumeGroups: [
              {
                name:            "test",
                physicalVolumes: [
                  {
                    generate: {
                      targetDevices: ["vda"],
                      encryption:    {
                        luks2: { password: "54321" }
                      }
                    }
                  }
                ],
                logicalVolumes:  [
                  { filesystem: { path: "/home" } }
                ]
              }
            ]
          }
        end

        it "generates the expected JSON" do
          encryption_model = subject.convert[:encryption]

          expect(encryption_model).to eq(
            {
              method:   "luks1",
              password: "12345"
            }
          )
        end
      end

      context "if there is a root logical volume" do
        let(:config_json) do
          {
            drives:       [
              {
                alias:      "vda",
                partitions: [
                  {
                    filesystem: { path: "/home" },
                    encryption: {
                      luks1: { password: "12345" }
                    }
                  }
                ]
              }
            ],
            volumeGroups: [
              {
                name:            "test",
                physicalVolumes: physicalVolumes,
                logicalVolumes:  [
                  { filesystem: { path: "/" } }
                ]
              }
            ]
          }
        end

        context "and the volume group has automatically generated and encrypted physical volumes" do
          let(:physicalVolumes) do
            [
              {
                generate: {
                  targetDevices: ["vda"],
                  encryption:    {
                    luks2: { password: "54321" }
                  }
                }
              }
            ]
          end

          it "generates the expected JSON" do
            encryption_model = subject.convert[:encryption]

            expect(encryption_model).to eq(
              {
                method:   "luks1",
                password: "12345"
              }
            )
          end
        end
      end

      context "if there is no encryption for root" do
        let(:config_json) do
          {
            drives:       [
              {
                alias:      "vda",
                partitions: [
                  {
                    filesystem: { path: "/" }
                  },
                  {
                    filesystem: { path: "/home" },
                    encryption: encryption
                  }
                ]
              }
            ],
            volumeGroups: [
              {
                name:            "test",
                physicalVolumes: physicalVolumes,
                logicalVolumes:  [
                  { filesystem: { path: "swap" } }
                ]
              }
            ]
          }
        end

        let(:physicalVolumes) do
          [
            {
              generate: {
                targetDevices: ["vda"],
                encryption:    {
                  luks2: { password: "54321" }
                }
              }
            }
          ]
        end

        context "and there is an encrypted partition" do
          let(:encryption) do
            {
              luks1: { password: "12345" }
            }
          end

          it "generates the expected JSON" do
            encryption_model = subject.convert[:encryption]

            expect(encryption_model).to eq(
              {
                method:   "luks1",
                password: "12345"
              }
            )
          end
        end

        context "and there is no encrypted partition" do
          let(:encryption) { nil }

          it "generates the expected JSON" do
            encryption_model = subject.convert[:encryption]

            expect(encryption_model).to eq(
              {
                method:   "luks2",
                password: "54321"
              }
            )
          end

          context "if there is no automatically generated and encrypted physical volumes" do
            let(:physicalVolumes) do
              [
                {
                  generate: {
                    targetDevices: ["vda"]
                  }
                }
              ]
            end

            it "generates the expected JSON" do
              encryption_model = subject.convert[:encryption]

              expect(encryption_model).to be_nil
            end
          end
        end
      end
    end
  end
end
