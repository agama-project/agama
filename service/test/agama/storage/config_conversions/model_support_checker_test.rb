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

require_relative "../config_context"
require "agama/storage/model_support_checker"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

describe Agama::Storage::ModelSupportChecker do
  include_context "config"

  let(:product_data) do
    {
      "storage" => {
        "volumes"          => ["/", "swap"],
        "volume_templates" => [
          {
            "mount_path" => "/",
            "filesystem" => "btrfs",
            "size"       => {
              "auto" => true,
              "min"  => "5 GiB",
              "max"  => "10 GiB"
            },
            "btrfs"      => {
              "snapshots" => true
            },
            "outline"    => {
              "required"               => true,
              "snapshots_configurable" => true,
              "auto_size"              => {
                "base_min" => "5 GiB",
                "base_max" => "10 GiB"
              }
            }
          },
          {
            "mount_path" => "/home",
            "filesystem" => "xfs",
            "size"       => {
              "auto" => false,
              "min"  => "5 GiB"
            },
            "outline"    => {
              "required" => false
            }
          },
          {
            "mount_path" => "swap",
            "filesystem" => "swap",
            "size"       => {
              "auto" => true
            },
            "outline"    => {
              "auto_size" => {
                "base_min" => "2 GiB",
                "base_max" => "4 GiB"
              }
            }
          },
          {
            "mount_path" => "",
            "filesystem" => "ext4",
            "size"       => {
              "min" => "100 MiB"
            }
          }
        ]
      }
    }
  end

  subject { described_class.new(config) }

  before { solve_config }

  describe "#supported?" do
    shared_examples "partitionable without name" do
      context "and the device is going to be skipped" do
        let(:if_not_found) { "skip" }

        it "returns true" do
          expect(subject.supported?).to eq(true)
        end
      end

      context "and the device is not going to be skipped" do
        let(:if_not_found) { "error" }

        it "returns false" do
          expect(subject.supported?).to eq(false)
        end
      end
    end

    let(:scenario) { "disks.yaml" }

    # The drive is not found and it is not searched by name.
    context "if there is a drive with unknown name" do
      let(:scenario) { "empty-hd-50GiB.yaml" }

      let(:config_json) do
        {
          drives: [
            {},
            { search: { ifNotFound: if_not_found } }
          ]
        }
      end

      include_examples "partitionable without name"
    end

    # The MD RAID is not found and it is not searched by name.
    context "if there is a MD RAID with unknown name" do
      let(:config_json) do
        {
          mdRaids: [
            { search: { ifNotFound: if_not_found } }
          ]
        }
      end

      include_examples "partitionable without name"
    end

    shared_examples "partitionable with encryption" do
      context "and the device is going to be skipped" do
        let(:condition) { { name: "/not/found" } }
        let(:filesystem) { nil }

        it "returns true" do
          expect(subject.supported?).to eq(true)
        end
      end

      context "and the device is not going to be skipped" do
        let(:condition) { nil }

        context "and the device has no filesystem" do
          let(:filesystem) { nil }

          it "returns false" do
            expect(subject.supported?).to eq(false)
          end
        end

        context "and the device has filesystem" do
          context "and the filesystem is going to be created" do
            let(:filesystem) { { reuseIfPossible: false } }

            it "returns true" do
              expect(subject.supported?).to eq(true)
            end
          end

          context "and the filesystem is going to be reused" do
            let(:filesystem) { { reuseIfPossible: true } }

            it "returns false" do
              expect(subject.supported?).to eq(false)
            end
          end
        end
      end
    end

    context "if there is a drive with encryption" do
      let(:config_json) do
        {
          drives: [
            {
              search:     {
                condition:  condition,
                ifNotFound: "skip"
              },
              encryption: {
                luks1: { password: "12345" }
              },
              filesystem: filesystem
            }
          ]
        }
      end

      include_examples "partitionable with encryption"
    end

    context "if there is a MD RAID with encryption" do
      let(:scenario) { "md_raids.yaml" }

      let(:config_json) do
        {
          mdRaids: [
            {
              search:     {
                condition:  condition,
                ifNotFound: "skip"
              },
              encryption: {
                luks1: { password: "12345" }
              },
              filesystem: filesystem
            }
          ]
        }
      end

      include_examples "partitionable with encryption"
    end

    context "if there is a LVM thin pool" do
      let(:config_json) do
        {
          volumeGroups: [
            {
              name:           "system",
              logicalVolumes: [
                { pool: true }
              ]
            }
          ]
        }
      end

      it "returns false" do
        expect(subject.supported?).to eq(false)
      end
    end

    context "if there is a LVM thin volume" do
      let(:config_json) do
        {
          volumeGroups: [
            {
              name:           "system",
              logicalVolumes: [
                { usedPool: "pool" }
              ]
            }
          ]
        }
      end

      it "returns false" do
        expect(subject.supported?).to eq(false)
      end
    end

    context "if there is a LVM volume group without name" do
      let(:config_json) do
        {
          volumeGroups: [{}]
        }
      end

      it "returns false" do
        expect(subject.supported?).to eq(false)
      end
    end

    context "if there is a LVM volume group with specific physical volumes" do
      let(:config_json) do
        {
          volumeGroups: [
            {
              name:            "system",
              physicalVolumes: ["pv1"]
            }
          ]
        }
      end

      it "returns false" do
        expect(subject.supported?).to eq(false)
      end
    end

    context "if there is a partition without mount path" do
      let(:scenario) { "disks.yaml" }

      let(:config_json) do
        {
          drives: [
            {
              search:     "/dev/vda",
              partitions: [
                {
                  search:         search,
                  delete:         delete,
                  deleteIfNeeded: deleteIfNeeded,
                  filesystem:     filesystem,
                  encryption:     encryption,
                  size:           size
                }
              ]
            }
          ]
        }
      end

      let(:search) { nil }
      let(:delete) { nil }
      let(:deleteIfNeeded) { nil }
      let(:filesystem) { nil }
      let(:encryption) { nil }
      let(:size) { nil }

      context "and the partition has not a search (new partition)" do
        let(:search) { nil }

        it "returns false" do
          expect(subject.supported?).to eq(false)
        end
      end

      context "and the partition has a search" do
        let(:search) do
          {
            condition:  condition,
            ifNotFound: if_not_found
          }
        end

        let(:if_not_found) { nil }

        shared_examples "reused partition" do
          context "and the partition is set to be deleted" do
            let(:delete) { true }

            it "returns true" do
              expect(subject.supported?).to eq(true)
            end
          end

          context "and the partition is set to be deleted if needed" do
            let(:deleteIfNeeded) { true }

            it "returns true" do
              expect(subject.supported?).to eq(true)
            end
          end

          context "and the partition is not set to be deleted" do
            let(:delete) { false }
            let(:deleteIfNeeded) { false }

            context "and the partition has encryption" do
              let(:encryption) do
                { luks1: { password: "12345" } }
              end

              it "returns false" do
                expect(subject.supported?).to eq(false)
              end
            end

            context "and the partition has filesystem" do
              let(:filesystem) { { type: "xfs" } }

              it "returns false" do
                expect(subject.supported?).to eq(false)
              end
            end

            context "and the partition has a size" do
              let(:size) do
                {
                  default: false,
                  min:     1.GiB,
                  max:     10.GiB
                }
              end

              it "returns false" do
                expect(subject.supported?).to eq(false)
              end
            end

            context "and the partition is only set to be resized if needed" do
              let(:encryption) { nil }
              let(:filesystem) { nil }
              let(:size) do
                {
                  default: false,
                  min:     Y2Storage::DiskSize.zero
                }
              end

              it "returns true" do
                expect(subject.supported?).to eq(true)
              end
            end
          end
        end

        context "and the partition is found" do
          let(:condition) { { name: "/dev/vda1" } }

          include_examples "reused partition"
        end

        context "and the partition is not found" do
          let(:condition) { { name: "/no/found" } }

          context "and the partition can be skipped" do
            let(:if_not_found) { "skip" }

            it "returns true" do
              expect(subject.supported?).to eq(true)
            end
          end

          context "and the partition cannot be skipped" do
            let(:if_not_found) { "error" }

            include_examples "reused partition"
          end

          context "and the partition can be created" do
            let(:if_not_found) { "create" }

            it "returns false" do
              expect(subject.supported?).to eq(false)
            end
          end
        end
      end
    end

    context "if there is a LVM logical volume without mount path" do
      let(:config_json) do
        {
          volumeGroups: [
            {
              name:           "system",
              logicalVolumes: [{}]
            }
          ]
        }
      end

      it "returns false" do
        expect(subject.supported?).to eq(false)
      end
    end

    context "if there is a LVM logical volume with encryption" do
      let(:config_json) do
        {
          volumeGroups: [
            {
              name:           "system",
              logicalVolumes: [
                {
                  encryption: {
                    luks1: { password: "12345" }
                  }
                }
              ]
            }
          ]
        }
      end

      it "returns false" do
        expect(subject.supported?).to eq(false)
      end
    end

    context "if the config includes encryption for everything except an arbitrary partition" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                { filesystem: { path: "/home" } },
                {
                  encryption: { luks1: { password: "12345" } },
                  filesystem: { path: "/" }
                }
              ]
            }
          ]
        }
      end

      it "returns false" do
        expect(subject.supported?).to eq(false)
      end
    end

    context "if the config includes encryption for everything except /boot/zipl" do
      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                { filesystem: { path: "/boot/zipl" } },
                {
                  encryption: { luks1: { password: "12345" } },
                  filesystem: { path: "/" }
                }
              ]
            }
          ]
        }
      end

      it "returns true" do
        expect(subject.supported?).to eq(true)
      end
    end

    context "if the config is totally supported" do
      let(:scenario) { "md_raids.yaml" }

      let(:config_json) do
        {
          drives:       [
            {
              search:     "/dev/vda",
              partitions: [
                { search: "/dev/vda1", delete: true },
                {
                  search: "/dev/vda2",
                  size:   { default: false, min: 0 }
                },
                {
                  encryption: {
                    luks1: { password: "12345" }
                  },
                  filesystem: { path: "/", type: "btrfs" }
                }
              ]
            },
            { alias: "pv" }
          ],
          mdRaids:      [
            {
              search:     "/dev/md1",
              partitions: [
                { search: "*", delete: true },
                {
                  filesystem: { path: "/home", type: "xfs" },
                  encryption: {
                    luks1: { password: "12345" }
                  }
                }
              ]
            }
          ],
          volumeGroups: [
            {
              name:            "data",
              physicalVolumes: [
                {
                  generate: {
                    targetDevices: ["pv"],
                    encryption:    {
                      luks1: { password: "12345" }
                    }
                  }
                }
              ],
              logicalVolumes:  [
                {
                  filesystem: { path: "/data" },
                  size:       { min: "10 GiB" }
                }
              ]
            }
          ]
        }
      end

      it "returns true" do
        expect(subject.supported?).to eq(true)
      end
    end
  end
end
