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

require_relative "../storage_helpers"
require_relative "../../../test_helper"
require "agama/storage/config_conversions"
require "agama/storage/config_solver"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

shared_examples "without name" do |result_scope|
  it "generates the expected JSON" do
    model_json = result_scope.call(subject.convert)
    expect(model_json.keys).to_not include(:name)
  end
end

shared_examples "without filesystem" do |result_scope|
  it "generates the expected JSON" do
    model_json = result_scope.call(subject.convert)
    expect(model_json.keys).to_not include(:mountPath)
    expect(model_json.keys).to_not include(:filesystem)
  end
end

shared_examples "without ptable_type" do |result_scope|
  it "generates the expected JSON" do
    model_json = result_scope.call(subject.convert)
    expect(model_json.keys).to_not include(:ptableType)
  end
end

shared_examples "without partitions" do |result_scope|
  it "generates the expected JSON" do
    model_json = result_scope.call(subject.convert)
    expect(model_json[:spacePolicy]).to eq("keep")
    expect(model_json[:partitions]).to eq([])
  end
end

shared_examples "with name" do |result_scope, device_scope|
  let(:search) { device.name }
  let(:device) { device_scope.call(devicegraph) }

  it "generates the expected JSON" do
    model_json = result_scope.call(subject.convert)
    expect(model_json[:name]).to eq(device.name)
  end
end

shared_examples "with filesystem" do |result_scope|
  let(:filesystem) do
    {
      reuseIfPossible: true,
      type:            "xfs",
      label:           "test",
      path:            "/test",
      mountBy:         "device",
      mkfsOptions:     ["version=2"],
      mountOptions:    ["rw"]
    }
  end

  it "generates the expected JSON" do
    model_json = result_scope.call(subject.convert)
    expect(model_json[:mountPath]).to eq("/test")
    expect(model_json[:filesystem]).to eq(
      {
        reuse:   true,
        default: false,
        type:    "xfs",
        label:   "test"
      }
    )
  end

  context "with a default filesystem" do
    let(:filesystem) { { path: "/" } }

    it "generates the expected JSON" do
      model_json = result_scope.call(subject.convert)
      expect(model_json[:mountPath]).to eq("/")
      expect(model_json[:filesystem]).to eq(
        {
          reuse:     false,
          default:   true,
          type:      "btrfs",
          snapshots: true
        }
      )
    end
  end
end

shared_examples "with ptable_type" do |result_scope|
  let(:ptableType) { "gpt" }

  it "generates the expected JSON" do
    model_json = result_scope.call(subject.convert)
    expect(model_json[:ptableType]).to eq("gpt")
  end
end

shared_examples "with partitions" do |result_scope, device_scope|
  let(:partitions) do
    [
      partition,
      {}
    ]
  end

  let(:partition) { {} }

  let(:default_partition_json) do
    {
      delete:         false,
      deleteIfNeeded: false,
      resize:         false,
      resizeIfNeeded: false,
      size:           { default: true, min: 100.MiB.to_i }
    }
  end

  it "generates the expected JSON" do
    model_json = result_scope.call(subject.convert)
    expect(model_json[:partitions]).to eq(
      [
        default_partition_json,
        default_partition_json
      ]
    )
  end

  context "if a partition is set to delete without device" do
    let(:partition) { { delete: true } }

    it "generates the expected JSON" do
      model_json = result_scope.call(subject.convert)
      expect(model_json[:partitions]).to eq(
        [
          {
            delete:         true,
            deleteIfNeeded: false,
            resize:         false,
            resizeIfNeeded: false,
            size:           { default: true, min: 100.MiB.to_i }
          },
          default_partition_json
        ]
      )
    end
  end

  context "if a partition is set to delete if needed without device" do
    let(:partition) { { deleteIfNeeded: true } }

    it "generates the expected JSON" do
      model_json = result_scope.call(subject.convert)
      expect(model_json[:partitions]).to eq(
        [
          {
            delete:         false,
            deleteIfNeeded: true,
            resize:         false,
            resizeIfNeeded: false,
            size:           { default: true, min: 100.MiB.to_i }
          },
          default_partition_json
        ]
      )
    end
  end

  context "if a device is not found for a partition" do
    let(:partition) { { search: "/not/found" } }

    it "generates the expected JSON" do
      model_json = result_scope.call(subject.convert)
      expect(model_json[:partitions]).to eq(
        [
          {
            name:           "/not/found",
            delete:         false,
            deleteIfNeeded: false,
            resize:         false,
            resizeIfNeeded: false,
            size:           { default: true, min: 0 }
          },
          default_partition_json
        ]
      )
    end
  end

  context "if a partition should be created if not found" do
    let(:partition) do
      {
        search: {
          condition:  { name: "/not/found" },
          ifNotFound: "create"
        }
      }
    end

    it "generates the expected JSON" do
      model_json = result_scope.call(subject.convert)
      expect(model_json[:partitions]).to eq(
        [
          default_partition_json,
          default_partition_json
        ]
      )
    end
  end

  context "if a device is found for a partition" do
    # The device should have at least one partition.
    let(:partition_device) { device_scope.call(devicegraph).partitions.first }

    let(:partition) { { search: partition_device.name } }

    it "generates the expected JSON" do
      model_json = result_scope.call(subject.convert)
      expect(model_json[:partitions]).to eq(
        [
          {
            name:           partition_device.name,
            delete:         false,
            deleteIfNeeded: false,
            resize:         false,
            resizeIfNeeded: false,
            size:           {
              default: true,
              min:     partition_device.size.to_i,
              max:     partition_device.size.to_i
            }
          },
          default_partition_json
        ]
      )
    end
  end

  partition_result_scope = proc { |c| result_scope.call(c)[:partitions].first }
  partition_scope = proc { |c| device_scope.call(c).partitions.first }

  context "if a device is not assigned to a partition" do
    let(:partition) { {} }
    include_examples "without name", partition_result_scope
  end

  context "if #id is not configured for a partition" do
    let(:partition) { {} }

    it "generates the expected JSON" do
      model_json = partition_result_scope.call(subject.convert)
      expect(model_json.keys).to_not include(:id)
    end
  end

  context "if #filesystem is not configured for a partition" do
    let(:partition) { {} }
    include_examples "without filesystem", partition_result_scope
  end

  context "if a device is assigned to a partition" do
    let(:partition) { { search: search } }
    include_examples "with name", partition_result_scope, partition_scope
  end

  context "if #id is configured for a partition" do
    let(:partition) { { id: "esp" } }

    it "generates the expected JSON" do
      model_json = partition_result_scope.call(subject.convert)
      expect(model_json[:id]).to eq("esp")
    end
  end

  context "if #filesystem is configured for a partition" do
    let(:partition) { { filesystem: filesystem } }
    include_examples "with filesystem", partition_result_scope
  end

  context "for the #size property" do
    let(:partition) { { search: search, size: size } }
    include_examples "#size property", partition_result_scope, partition_scope
  end

  context "for the #delete property" do
    let(:partition) { { search: device.name, delete: delete } }
    let(:device) { partition_scope.call(devicegraph) }
    include_examples "#delete property", partition_result_scope
  end

  context "for the #deleteIfNeeded property" do
    let(:partition) { { search: device.name, deleteIfNeeded: delete_if_needed } }
    let(:device) { partition_scope.call(devicegraph) }
    include_examples "#deleteIfNeeded property", partition_result_scope
  end
end

shared_examples "#spacePolicy property" do |result_scope|
  context "if there is a 'delete all' partition" do
    let(:partitions) do
      [
        { search: "*", delete: true },
        { size: "2 GiB" }
      ]
    end

    it "generates the expected JSON" do
      model_json = result_scope.call(subject.convert)
      expect(model_json[:spacePolicy]).to eq("delete")
    end
  end

  context "if there is a 'resize all' partition" do
    let(:partitions) do
      [
        { search: "*", size: { min: 0, max: "current" } },
        { size: "2 GiB" }
      ]
    end

    it "generates the expected JSON" do
      model_json = result_scope.call(subject.convert)
      expect(model_json[:spacePolicy]).to eq("resize")
    end
  end

  context "if there is a 'delete' partition" do
    let(:partitions) do
      [
        { search: { max: 1 }, delete: true },
        { filesystem: { path: "/" } }
      ]
    end

    it "generates the expected JSON" do
      model_json = result_scope.call(subject.convert)
      expect(model_json[:spacePolicy]).to eq("custom")
    end
  end

  context "if there is a 'delete if needed' partition" do
    let(:partitions) do
      [
        { search: { max: 1 }, deleteIfNeeded: true },
        { filesystem: { path: "/" } }
      ]
    end

    it "generates the expected JSON" do
      model_json = result_scope.call(subject.convert)
      expect(model_json[:spacePolicy]).to eq("custom")
    end
  end

  context "if there is a 'resize' partition" do
    let(:partitions) do
      [
        { search: { max: 1 }, size: "1 GiB" },
        { filesystem: { path: "/" } }
      ]
    end

    it "generates the expected JSON" do
      model_json = result_scope.call(subject.convert)
      expect(model_json[:spacePolicy]).to eq("custom")
    end
  end

  context "if there is a 'resize if needed' partition" do
    let(:partitions) do
      [
        { search: { max: 1 }, size: { min: 0, max: "1 GiB" } },
        { filesystem: { path: "/" } }
      ]
    end

    it "generates the expected JSON" do
      model_json = result_scope.call(subject.convert)
      expect(model_json[:spacePolicy]).to eq("custom")
    end
  end

  context "if there is neither 'delete' nor 'resize' partition" do
    let(:partitions) do
      [
        { size: { min: "1 GiB" } },
        { filesystem: { path: "/" } }
      ]
    end

    it "generates the expected JSON" do
      model_json = result_scope.call(subject.convert)
      expect(model_json[:spacePolicy]).to eq("keep")
    end
  end
end

shared_examples "#size property" do |result_scope, partition_scope|
  context "if there is not device assigned to the config" do
    let(:search) { nil }

    context "if the config contains the default product size" do
      let(:size) { nil }

      it "generates the expected JSON" do
        model_json = result_scope.call(subject.convert)
        expect(model_json[:size]).to eq(
          {
            default: true,
            min:     100.MiB.to_i
          }
        )
      end
    end

    context "if the config contains a specific size" do
      let(:size) { "10 GiB" }

      it "generates the expected JSON" do
        model_json = result_scope.call(subject.convert)
        expect(model_json[:size]).to eq(
          {
            default: false,
            min:     10.GiB.to_i,
            max:     10.GiB.to_i
          }
        )
      end
    end
  end

  context "if there is a device assigned to the config" do
    let(:search) { device.name }
    let(:device) { partition_scope.call(devicegraph) }

    context "if the config contains the default product size" do
      let(:size) { nil }

      it "generates the expected JSON" do
        model_json = result_scope.call(subject.convert)
        expect(model_json[:size]).to eq(
          {
            default: true,
            min:     device.size.to_i,
            max:     device.size.to_i
          }
        )
      end
    end

    context "if the config contains a specific size" do
      let(:size) { "10 GiB" }

      it "generates the expected JSON" do
        model_json = result_scope.call(subject.convert)
        expect(model_json[:size]).to eq(
          {
            default: false,
            min:     10.GiB.to_i,
            max:     10.GiB.to_i
          }
        )
      end
    end
  end
end

shared_examples "#delete property" do |result_scope|
  context "if #delete is set to false" do
    let(:delete) { false }

    it "generates the expected JSON" do
      model_json = result_scope.call(subject.convert)
      expect(model_json[:delete]).to eq(false)
    end
  end

  context "if #delete is set to true" do
    let(:delete) { true }

    it "generates the expected JSON" do
      model_json = result_scope.call(subject.convert)
      expect(model_json[:delete]).to eq(true)
    end
  end
end

shared_examples "#deleteIfNeeded property" do |result_scope|
  context "if #delete_if_needed is set to false" do
    let(:delete_if_needed) { false }

    it "generates the expected JSON" do
      model_json = result_scope.call(subject.convert)
      expect(model_json[:deleteIfNeeded]).to eq(false)
    end
  end

  context "if #delete_if_needed is set to true" do
    let(:delete_if_needed) { true }

    it "generates the expected JSON" do
      model_json = result_scope.call(subject.convert)
      expect(model_json[:deleteIfNeeded]).to eq(true)
    end
  end
end

describe Agama::Storage::ConfigConversions::ToModel do
  include Agama::RSpec::StorageHelpers

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

  let(:product_config) { Agama::Config.new(product_data) }

  let(:devicegraph) { Y2Storage::StorageManager.instance.probed }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSON
      .new(config_json)
      .convert
      .tap { |c| Agama::Storage::ConfigSolver.new(product_config, devicegraph).solve(c) }
  end

  before do
    mock_storage(devicegraph: scenario)
    # To speed-up the tests
    allow(Y2Storage::EncryptionMethod::TPM_FDE)
      .to(receive(:possible?))
      .and_return(true)
  end

  subject { described_class.new(config) }

  describe "#convert" do
    let(:scenario) { "disks.yaml" }

    context "with the default config" do
      let(:config_json) { {} }

      it "generates the expected JSON" do
        expect(subject.convert).to eq(
          {
            boot:         {
              configure: true,
              device:    { default: true }
            },
            drives:       [],
            volumeGroups: []
          }
        )
      end
    end

    context "if #boot is set to be configured" do
      let(:config_json) do
        {
          boot:   {
            configure: true,
            device:    device_alias
          },
          drives: [
            {
              search:     "/dev/vda",
              partitions: [
                { filesystem: { path: "/" } }
              ]
            },
            {
              search: "/dev/vdb",
              alias:  "vdb"
            },
            {
              search: "/not/found",
              alias:  "not-found"
            }
          ]
        }
      end

      context "and uses the default boot device" do
        let(:device_alias) { nil }

        it "generates the expected JSON for 'boot'" do
          boot_model = subject.convert[:boot]

          expect(boot_model).to eq(
            {
              configure: true,
              device:    {
                default: true,
                name:    "/dev/vda"
              }
            }
          )
        end
      end

      context "and uses a specific boot device" do
        let(:device_alias) { "vdb" }

        it "generates the expected JSON for 'boot'" do
          boot_model = subject.convert[:boot]

          expect(boot_model).to eq(
            {
              configure: true,
              device:    {
                default: false,
                name:    "/dev/vdb"
              }
            }
          )
        end

        context "and the boot device is not found" do
          let(:device_alias) { "not-found" }

          it "generates the expected JSON for 'boot'" do
            boot_model = subject.convert[:boot]

            expect(boot_model).to eq(
              {
                configure: true,
                device:    {
                  default: false,
                  name:    "/not/found"
                }
              }
            )
          end
        end
      end
    end

    context "if #boot is set to not be configured" do
      let(:config_json) do
        {
          boot:   {
            configure: false,
            device:    "vda"
          },
          drives: [
            {
              search: "/dev/vda",
              alias:  "vda"
            }
          ]
        }
      end

      it "generates the expected JSON for 'boot'" do
        boot_model = subject.convert[:boot]

        expect(boot_model).to eq(
          {
            configure: false
          }
        )
      end
    end

    context "for the global encryption" do
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

        it "generates the expected JSON for 'encryption'" do
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

          it "generates the expected JSON for 'encryption'" do
            encryption_model = subject.convert[:encryption]

            expect(encryption_model).to eq(
              {
                method:   "luks2",
                password: "54321"
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

          it "generates the expected JSON for 'encryption'" do
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

          it "generates the expected JSON for 'encryption'" do
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

            it "generates the expected JSON for 'encryption'" do
              encryption_model = subject.convert[:encryption]

              expect(encryption_model).to be_nil
            end
          end
        end
      end
    end

    context "if #drives is configured" do
      let(:config_json) do
        { drives: drives }
      end

      let(:drives) do
        [
          drive,
          {}
        ]
      end

      let(:drive) { {} }

      it "generates the expected JSON for 'drives'" do
        drives_model = subject.convert[:drives]

        expect(drives_model).to eq(
          [
            { name: "/dev/vda", spacePolicy: "keep", partitions: [] },
            { name: "/dev/vdb", spacePolicy: "keep", partitions: [] }
          ]
        )
      end

      context "if a device is not found for a drive" do
        let(:drive) { { search: "/dev/vdd" } }

        it "generates the expected JSON for 'drives'" do
          drives_model = subject.convert[:drives]

          expect(drives_model).to eq(
            [
              { name: "/dev/vdd", spacePolicy: "keep", partitions: [] },
              { name: "/dev/vda", spacePolicy: "keep", partitions: [] }
            ]
          )
        end

        context "and the drive is set to be skipped" do
          let(:drive) do
            {
              search: {
                condition:  { name: "/dev/vdd" },
                ifNotFound: "skip"
              }
            }
          end

          it "generates the expected JSON for 'drives'" do
            drives_model = subject.convert[:drives]

            expect(drives_model).to eq(
              [
                { name: "/dev/vda", spacePolicy: "keep", partitions: [] }
              ]
            )
          end
        end
      end

      context "if a device is found for a drive" do
        let(:drive) { { search: "/dev/vda" } }

        it "generates the expected JSON for 'drives'" do
          drives_model = subject.convert[:drives]

          expect(drives_model).to eq(
            [
              { name: "/dev/vda", spacePolicy: "keep", partitions: [] },
              { name: "/dev/vdb", spacePolicy: "keep", partitions: [] }
            ]
          )
        end
      end

      drive_result_scope = proc { |c| c[:drives].first }
      drive_scope = proc { |d| d.find_by_name("/dev/vda") }

      context "if #filesystem is not configured for a drive" do
        let(:drive) { {} }
        include_examples "without filesystem", drive_result_scope
      end

      context "if #ptable_type is not configured for a drive" do
        let(:drive) { {} }
        include_examples "without ptable_type", drive_result_scope
      end

      context "if #partitions is not configured for a drive" do
        let(:drive) { {} }
        include_examples "without partitions", drive_result_scope
      end

      context "if #filesystem is configured for a drive" do
        let(:drive) { { filesystem: filesystem } }
        include_examples "with filesystem", drive_result_scope
      end

      context "if #ptable_type is configured for a drive" do
        let(:drive) { { ptableType: ptableType } }
        include_examples "with ptable_type", drive_result_scope
      end

      context "if #partitions is configured for a drive" do
        let(:drive) { { partitions: partitions } }
        include_examples "with partitions", drive_result_scope, drive_scope
      end

      context "for the #spacePolicy property" do
        let(:drive) { { partitions: partitions } }
        include_examples "#spacePolicy property", drive_result_scope
      end
    end

    context "if #volume_groups is configured" do
      let(:config_json) do
        {
          drives:       [
            {
              search: "/dev/vda",
              alias:  "disk1"
            },
            {
              search: "/dev/vdb",
              alias:  "disk2"
            }
          ],
          volumeGroups: volume_groups
        }
      end

      let(:volume_groups) do
        [
          volume_group,
          {}
        ]
      end

      let(:volume_group) { {} }

      it "generates the expected JSON for 'VolumeGroups'" do
        volume_groups_model = subject.convert[:volumeGroups]

        expect(volume_groups_model).to eq(
          [
            { targetDevices: [], logicalVolumes: [] },
            { targetDevices: [], logicalVolumes: [] }
          ]
        )
      end

      vg_result_scope = proc { |c| c[:volumeGroups].first }

      context "if #name is not configured for a volume group" do
        let(:volume_group) { {} }

        it "generates the expected JSON" do
          model_json = vg_result_scope.call(subject.convert)
          expect(model_json.keys).to_not include(:vgName)
        end
      end

      context "if #extent_size is not configured for a volume group" do
        let(:volume_group) { {} }

        it "generates the expected JSON" do
          model_json = vg_result_scope.call(subject.convert)
          expect(model_json.keys).to_not include(:extentSize)
        end
      end

      context "if #physical_volumes_devices is not configured for a volume group" do
        let(:volume_group) { {} }

        it "generates the expected JSON" do
          model_json = vg_result_scope.call(subject.convert)
          expect(model_json[:targetDevices]).to eq([])
        end
      end

      context "if #logical_volumes is not configured for a volume group" do
        let(:volume_group) { {} }

        it "generates the expected JSON" do
          model_json = vg_result_scope.call(subject.convert)
          expect(model_json[:logicalVolumes]).to eq([])
        end
      end

      context "if #name is configured for a volume group" do
        let(:volume_group) { { name: "test" } }

        it "generates the expected JSON" do
          model_json = vg_result_scope.call(subject.convert)
          expect(model_json[:vgName]).to eq("test")
        end
      end

      context "if #extent_size is configured for a volume group" do
        let(:volume_group) { { extentSize: "1 KiB" } }

        it "generates the expected JSON" do
          model_json = vg_result_scope.call(subject.convert)
          expect(model_json[:extentSize]).to eq(1.KiB.to_i)
        end
      end

      context "if #physical_volumes_devices is configured for a volume group" do
        let(:volume_group) do
          {
            physicalVolumes: [{ generate: ["disk1", "disk2"] }]
          }
        end

        it "generates the expected JSON" do
          model_json = vg_result_scope.call(subject.convert)
          expect(model_json[:targetDevices]).to eq(["/dev/vda", "/dev/vdb"])
        end
      end

      context "if #logical_volumes is configured for a volume group" do
        let(:volume_group) do
          {
            logicalVolumes: [logical_volume, {}]
          }
        end

        let(:logical_volume) { {} }

        it "generates the expected JSON" do
          model_json = vg_result_scope.call(subject.convert)
          expect(model_json[:logicalVolumes].size).to eq(2)
        end

        lv_result_scope = proc { |c| vg_result_scope.call(c)[:logicalVolumes].first }

        context "if #name is not configured for a logical volume" do
          let(:logical_volume) { {} }

          it "generates the expected JSON" do
            model_json = lv_result_scope.call(subject.convert)
            expect(model_json.keys).to_not include(:lvName)
          end
        end

        context "if #filesystem is not configured for a logical volume" do
          let(:logical_volume) { {} }
          include_examples "without filesystem", lv_result_scope
        end

        context "if #size is not configured for a logical volume" do
          let(:logical_volume) { {} }

          it "generates the expected JSON" do
            model_json = lv_result_scope.call(subject.convert)
            expect(model_json[:size]).to eq(
              {
                default: true,
                min:     100.MiB.to_i
              }
            )
          end
        end

        context "if #stripes is not configured for a logical volume" do
          let(:logical_volume) { {} }

          it "generates the expected JSON" do
            model_json = lv_result_scope.call(subject.convert)
            expect(model_json.keys).to_not include(:stripes)
          end
        end

        context "if #stripe_size is not configured for a logical volume" do
          let(:logical_volume) { {} }

          it "generates the expected JSON" do
            model_json = lv_result_scope.call(subject.convert)
            expect(model_json.keys).to_not include(:stripeSize)
          end
        end

        context "if #name is configured for a logical volume" do
          let(:logical_volume) { { name: "test" } }

          it "generates the expected JSON" do
            model_json = lv_result_scope.call(subject.convert)
            expect(model_json[:lvName]).to eq("test")
          end
        end

        context "if #filesystem is configured for a logical volume" do
          let(:logical_volume) { { filesystem: filesystem } }
          include_examples "with filesystem", lv_result_scope
        end

        context "if #size is not configured for a logical volume" do
          let(:logical_volume) do
            {
              size: {
                min: "1 GiB",
                max: "5 GiB"
              }
            }
          end

          it "generates the expected JSON" do
            model_json = lv_result_scope.call(subject.convert)
            expect(model_json[:size]).to eq(
              {
                default: false,
                min:     1.GiB.to_i,
                max:     5.GiB.to_i
              }
            )
          end
        end

        context "if #stripes is configured for a logical volume" do
          let(:logical_volume) { { stripes: 8 } }

          it "generates the expected JSON" do
            model_json = lv_result_scope.call(subject.convert)
            expect(model_json[:stripes]).to eq(8)
          end
        end

        context "if #stripe_size is configured for a logical volume" do
          let(:logical_volume) { { stripeSize: "4 KiB" } }

          it "generates the expected JSON" do
            model_json = lv_result_scope.call(subject.convert)
            expect(model_json[:stripeSize]).to eq(4.KiB.to_i)
          end
        end
      end
    end
  end
end
