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

require_relative "../../../test_helper"
require "agama/storage/config_conversions"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

shared_examples "without search" do |result_scope|
  it "generates the expected JSON" do
    config_json = result_scope.call(subject.convert)
    expect(config_json.keys).to_not include(:search)
  end
end

shared_examples "without alias" do |result_scope|
  it "generates the expected JSON" do
    config_json = result_scope.call(subject.convert)
    expect(config_json.keys).to_not include(:alias)
  end
end

shared_examples "without encryption" do |result_scope|
  it "generates the expected JSON" do
    config_json = result_scope.call(subject.convert)
    expect(config_json.keys).to_not include(:encryption)
  end
end

shared_examples "without filesystem" do |result_scope|
  it "generates the expected JSON" do
    config_json = result_scope.call(subject.convert)
    expect(config_json.keys).to_not include(:filesystem)
  end
end

shared_examples "without ptable_type" do |result_scope|
  it "generates the expected JSON" do
    config_json = result_scope.call(subject.convert)
    expect(config_json.keys).to_not include(:ptableType)
  end
end

shared_examples "without partitions" do |result_scope|
  it "generates the expected JSON" do
    config_json = result_scope.call(subject.convert)
    expect(config_json[:partitions]).to eq([])
  end
end

shared_examples "without size" do |result_scope|
  it "generates the expected JSON" do
    config_json = result_scope.call(subject.convert)
    expect(config_json.keys).to_not include(:size)
  end
end

shared_examples "without delete" do |result_scope|
  it "generates the expected JSON" do
    config_json = result_scope.call(subject.convert)
    expect(config_json.keys).to_not include(:delete)
  end
end

shared_examples "without delete_if_needed" do |result_scope|
  it "generates the expected JSON" do
    config_json = result_scope.call(subject.convert)
    expect(config_json.keys).to_not include(:deleteIfNeeded)
  end
end

shared_examples "with search" do |result_scope|
  let(:search) do
    {
      condition:  { name: "/dev/vda1" },
      ifNotFound: "skip",
      max:        2
    }
  end

  it "generates the expected JSON" do
    config_json = result_scope.call(subject.convert)
    search_json = config_json[:search]

    expect(search_json).to eq(
      {
        condition:  { name: "/dev/vda1" },
        ifNotFound: "skip",
        max:        2
      }
    )
  end

  context "if the device name is not provided" do
    let(:search) { {} }

    it "generates the expected JSON" do
      config_json = result_scope.call(subject.convert)
      search_json = config_json[:search]

      expect(search_json).to eq(
        {
          ifNotFound: "error"
        }
      )
    end

    context "and a device was assigned" do
      before do
        allow_any_instance_of(Agama::Storage::Configs::Search)
          .to(receive(:device))
          .and_return(device)
      end

      let(:device) { instance_double(Y2Storage::BlkDevice, name: "/dev/vda") }

      it "generates the expected JSON" do
        config_json = result_scope.call(subject.convert)
        search_json = config_json[:search]

        expect(search_json).to eq(
          {
            condition:  { name: "/dev/vda" },
            ifNotFound: "error"
          }
        )
      end
    end
  end

  context "if there are no conditions or limits and errors should be skipped" do
    let(:search) { { ifNotFound: "skip" } }

    it "generates the expected JSON" do
      config_json = result_scope.call(subject.convert)
      search_json = config_json[:search]

      expect(search_json).to eq(
        {
          ifNotFound: "skip"
        }
      )
    end
  end
end

shared_examples "with alias" do |result_scope|
  let(:device_alias) { "test" }

  it "generates the expected JSON" do
    config_json = result_scope.call(subject.convert)
    expect(config_json[:alias]).to eq("test")
  end
end

shared_examples "with encryption" do |result_scope|
  let(:encryption) do
    {
      luks2: {
        password:     "12345",
        keySize:      256,
        pbkdFunction: "argon2i",
        cipher:       "twofish",
        label:        "test"
      }
    }
  end

  it "generates the expected JSON" do
    config_json = result_scope.call(subject.convert)
    encryption_json = config_json[:encryption]

    expect(encryption_json).to eq(
      {
        luks2: {
          password:     "12345",
          keySize:      256,
          pbkdFunction: "argon2i",
          cipher:       "twofish",
          label:        "test"
        }
      }
    )
  end

  context "if encryption only configures #password" do
    let(:encryption) do
      {
        luks2: {
          password: "12345"
        }
      }
    end

    it "generates the expected JSON" do
      config_json = result_scope.call(subject.convert)
      encryption_json = config_json[:encryption]

      expect(encryption_json).to eq(
        {
          luks2: {
            password: "12345"
          }
        }
      )
    end
  end

  context "if encryption method is pervasive LUKS2" do
    let(:encryption) do
      {
        pervasiveLuks2: {
          password: "12345"
        }
      }
    end

    it "generates the expected JSON" do
      config_json = result_scope.call(subject.convert)
      encryption_json = config_json[:encryption]

      expect(encryption_json).to eq(
        {
          pervasiveLuks2: {
            password: "12345"
          }
        }
      )
    end
  end

  context "if encryption method is TMP FDE" do
    let(:encryption) do
      {
        tpmFde: {
          password: "12345"
        }
      }
    end

    it "generates the expected JSON" do
      config_json = result_scope.call(subject.convert)
      encryption_json = config_json[:encryption]

      expect(encryption_json).to eq(
        {
          tpmFde: {
            password: "12345"
          }
        }
      )
    end
  end

  context "if encryption method is protected swap" do
    let(:encryption) { "protected_swap" }

    it "generates the expected JSON" do
      config_json = result_scope.call(subject.convert)
      encryption_json = config_json[:encryption]

      expect(encryption_json).to eq("protected_swap")
    end
  end

  context "if encryption method is not configured" do
    let(:encryption) { {} }

    it "generates the expected JSON" do
      config_json = result_scope.call(subject.convert)
      encryption_json = config_json[:encryption]
      expect(encryption_json).to be_nil
    end
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
    config_json = result_scope.call(subject.convert)
    filesystem_json = config_json[:filesystem]

    expect(filesystem_json).to eq(
      {
        reuseIfPossible: true,
        type:            "xfs",
        label:           "test",
        path:            "/test",
        mountBy:         "device",
        mkfsOptions:     ["version=2"],
        mountOptions:    ["rw"]
      }
    )
  end

  context "if filesystem configures #btrfs" do
    let(:filesystem) do
      {
        type: {
          btrfs: {
            snapshots: true
          }
        }
      }
    end

    it "generates the expected JSON" do
      config_json = result_scope.call(subject.convert)
      filesystem_json = config_json[:filesystem]

      expect(filesystem_json).to eq(
        {
          reuseIfPossible: false,
          type:            {
            btrfs: { snapshots: true }
          },
          mkfsOptions:     [],
          mountOptions:    []
        }
      )
    end
  end

  context "if filesystem does not configure #type" do
    let(:filesystem) { {} }

    it "generates the expected JSON" do
      config_json = result_scope.call(subject.convert)
      filesystem_json = config_json[:filesystem]

      expect(filesystem_json).to eq(
        {
          reuseIfPossible: false,
          mkfsOptions:     [],
          mountOptions:    []
        }
      )
    end
  end
end

shared_examples "with ptable_type" do |result_scope|
  let(:ptableType) { "gpt" }

  it "generates the expected JSON" do
    config_json = result_scope.call(subject.convert)
    expect(config_json[:ptableType]).to eq("gpt")
  end
end

shared_examples "with size" do |result_scope, config_scope|
  let(:size) do
    {
      min: "1 GiB",
      max: "10 GiB"
    }
  end

  it "generates the expected JSON" do
    config_json = result_scope.call(subject.convert)
    expect(config_json[:size]).to eq(
      {
        min: 1.GiB.to_i,
        max: 10.GiB.to_i
      }
    )
  end

  context "if max size is unlimited" do
    let(:size) do
      {
        min: "1 GiB"
      }
    end

    it "generates the expected JSON" do
      config_json = result_scope.call(subject.convert)
      expect(config_json[:size]).to eq(
        {
          min: 1.GiB.to_i
        }
      )
    end
  end

  context "if size was solved" do
    before do
      size_config = config_scope.call(config).size
      size_config.default = true
      size_config.min = 5.GiB
      size_config.max = 25.GiB
    end

    it "generates the expected JSON" do
      config_json = result_scope.call(subject.convert)
      expect(config_json[:size]).to eq(
        {
          min: 5.GiB.to_i,
          max: 25.GiB.to_i
        }
      )
    end
  end
end

shared_examples "with delete" do |result_scope|
  it "generates the expected JSON" do
    config_json = result_scope.call(subject.convert)
    expect(config_json[:delete]).to eq(true)
  end
end

shared_examples "with delete_if_needed" do |result_scope|
  it "generates the expected JSON" do
    config_json = result_scope.call(subject.convert)
    expect(config_json[:deleteIfNeeded]).to eq(true)
  end
end

shared_examples "with partitions" do |result_scope, config_scope|
  let(:partitions) do
    [
      partition,
      { search: "/dev/vda2", alias: "vda2" }
    ]
  end

  let(:partition) { { search: "/dev/vda1", alias: "vda1" } }

  it "generates the expected JSON" do
    config_json = result_scope.call(subject.convert)
    partitions_json = config_json[:partitions]

    expect(partitions_json).to eq(
      [
        {
          search: {
            condition:  { name: "/dev/vda1" },
            ifNotFound: "error"
          },
          alias:  "vda1"
        },
        {
          search: {
            condition:  { name: "/dev/vda2" },
            ifNotFound: "error"
          },
          alias:  "vda2"
        }
      ]
    )
  end

  partition_result_scope = proc { |c| result_scope.call(c)[:partitions].first }
  partition_scope = proc { |c| config_scope.call(c).partitions.first }

  context "if #search is not configured for a partition" do
    let(:partition) { { alias: "vda1" } }
    include_examples "without search", partition_result_scope
  end

  context "if #alias is not configured for a partition" do
    let(:partition) { { search: "/dev/vda1" } }
    include_examples "without alias", partition_result_scope
  end

  context "if #id is not configured for a partition" do
    let(:partition) { { search: "/dev/vda1" } }

    it "generates the expected JSON" do
      config_json = partition_result_scope.call(subject.convert)
      expect(config_json.keys).to_not include(:id)
    end
  end

  context "if #size is not configured for a partition" do
    let(:partition) { { search: "/dev/vda1" } }
    include_examples "without size", partition_result_scope
  end

  context "if #encryption is not configured for a partition" do
    let(:partition) { { search: "/dev/vda1" } }
    include_examples "without encryption", partition_result_scope
  end

  context "if #filesystem is not configured for a partition" do
    let(:partition) { { search: "/dev/vda1" } }
    include_examples "without filesystem", partition_result_scope
  end

  context "if #delete is not configured for a partition" do
    let(:partition) { { search: "/dev/vda1" } }
    include_examples "without delete", partition_result_scope
  end

  context "if #delete_if_needed is not configured for a partition" do
    let(:partition) { { search: "/dev/vda1" } }
    include_examples "without delete_if_needed", partition_result_scope
  end

  context "if #search is configured for a partition" do
    let(:partition) { { search: search } }
    include_examples "with search", partition_result_scope
  end

  context "if #alias is configured for a partition" do
    let(:partition) { { alias: device_alias } }
    include_examples "with alias", partition_result_scope
  end

  context "if #id is configured for a partition" do
    let(:partition) { { id: "esp" } }

    it "generates the expected JSON" do
      config_json = partition_result_scope.call(subject.convert)
      expect(config_json[:id]).to eq("esp")
    end
  end

  context "if #size is configured for a partition" do
    let(:partition) { { size: size } }
    include_examples "with size", partition_result_scope, partition_scope
  end

  context "if #encryption is configured for a partition" do
    let(:partition) { { encryption: encryption } }
    include_examples "with encryption", partition_result_scope
  end

  context "if #filesystem is configured for a partition" do
    let(:partition) { { filesystem: filesystem } }
    include_examples "with filesystem", partition_result_scope
  end

  context "if #delete is configured for a partition" do
    let(:partition) { { delete: true } }
    include_examples "with delete", partition_result_scope
  end

  context "if #delete_if_needed is configured for a partition" do
    let(:partition) { { deleteIfNeeded: true } }
    include_examples "with delete_if_needed", partition_result_scope
  end
end

describe Agama::Storage::ConfigConversions::ToJSON do
  before do
    # Speed up tests by avoding real check of TPM presence.
    allow(Y2Storage::EncryptionMethod::TPM_FDE).to receive(:possible?).and_return(true)
  end

  subject { described_class.new(config) }

  let(:config) do
    Agama::Storage::ConfigConversions::FromJSON
      .new(config_json)
      .convert
  end

  describe "#convert" do
    let(:config_json) { {} }

    it "returns a Hash" do
      expect(subject.convert).to be_a(Hash)
    end

    context "with the default config" do
      let(:config_json) { {} }

      it "generates the expected JSON" do
        expect(subject.convert).to eq(
          {
            boot:         {
              configure: true
            },
            drives:       [],
            volumeGroups: []
          }
        )
      end
    end

    context "if #boot is configured" do
      let(:config_json) do
        {
          boot: {
            configure: true,
            device:    "/dev/vdb"
          }
        }
      end

      it "generates the expected JSON for 'boot'" do
        boot_json = subject.convert[:boot]
        expect(boot_json).to eq(
          {
            configure: true,
            device:    "/dev/vdb"
          }
        )
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
        drives_json = subject.convert[:drives]

        default_drive_json = {
          search:     { ifNotFound: "error", max: 1 },
          partitions: []
        }

        expect(drives_json).to eq(
          [
            default_drive_json,
            default_drive_json
          ]
        )
      end

      drive_result_scope = proc { |c| c[:drives].first }
      drive_scope = proc { |c| c.drives.first }

      context "if #search is not configured for a drive" do
        let(:drive) { {} }

        it "generates the expected JSON for 'search'" do
          drive_json = drive_result_scope.call(subject.convert)
          search_json = drive_json[:search]

          expect(search_json).to eq(
            { ifNotFound: "error", max: 1 }
          )
        end
      end

      context "if #alias is not configured for a drive" do
        let(:drive) { {} }
        include_examples "without alias", drive_result_scope
      end

      context "if #encryption is not configured for a drive" do
        let(:drive) { {} }
        include_examples "without encryption", drive_result_scope
      end

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

      context "if #search is configured for a drive" do
        let(:drive) { { search: search } }
        include_examples "with search", drive_result_scope
      end

      context "if #alias is configured for a drive" do
        let(:drive) { { alias: device_alias } }
        include_examples "with alias", drive_result_scope
      end

      context "if #encryption is configured for a drive" do
        let(:drive) { { encryption: encryption } }
        include_examples "with encryption", drive_result_scope
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
    end

    context "if #volume_groups is configured" do
      let(:config_json) do
        { volumeGroups: volume_groups }
      end

      let(:volume_groups) do
        [
          volume_group,
          { name: "vg2" }
        ]
      end

      let(:volume_group) { { name: "vg1" } }

      it "generates the expected JSON" do
        volume_groups_json = subject.convert[:volumeGroups]
        expect(volume_groups_json).to eq(
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

      vg_result_scope = proc { |c| c[:volumeGroups].first }
      vg_scope = proc { |c| c.volume_groups.first }

      context "if #name is not configured for a volume group" do
        let(:volume_group) { {} }

        it "generates the expected JSON" do
          vg_json = vg_result_scope.call(subject.convert)
          expect(vg_json.keys).to_not include(:name)
        end
      end

      context "if #extent_size is not configured for a volume group" do
        let(:volume_group) { {} }

        it "generates the expected JSON" do
          vg_json = vg_result_scope.call(subject.convert)
          expect(vg_json.keys).to_not include(:extentSize)
        end
      end

      context "if #physical_volumes is not configured for a volume group" do
        let(:volume_group) { {} }

        it "generates the expected JSON" do
          vg_json = vg_result_scope.call(subject.convert)
          expect(vg_json[:physicalVolumes]).to eq([])
        end
      end

      context "if #logical_volumes is not configured for a volume group" do
        let(:volume_group) { {} }

        it "generates the expected JSON" do
          vg_json = vg_result_scope.call(subject.convert)
          expect(vg_json[:logicalVolumes]).to eq([])
        end
      end

      context "if #name is configured for a volume group" do
        let(:volume_group) { { name: "test" } }

        it "generates the expected JSON" do
          vg_json = vg_result_scope.call(subject.convert)
          expect(vg_json[:name]).to eq("test")
        end
      end

      context "if #extent_size is configured for a volume group" do
        let(:volume_group) { { extentSize: "4 KiB" } }

        it "generates the expected JSON" do
          vg_json = vg_result_scope.call(subject.convert)
          expect(vg_json[:extentSize]).to eq(4.KiB.to_i)
        end
      end

      context "if #physical_volumes is configured for a volume group" do
        let(:volume_group) { { physicalVolumes: ["pv1", "pv2"] } }

        it "generates the expected JSON" do
          vg_json = vg_result_scope.call(subject.convert)
          expect(vg_json[:physicalVolumes]).to eq(["pv1", "pv2"])
        end

        context "and #physical_volumes_devices is configured" do
          let(:volume_group) do
            {
              physicalVolumes: [
                "pv1",
                "pv2",
                {
                  generate: {
                    targetDevices: ["disk1"]
                  }
                }
              ]
            }
          end

          it "generates the expected JSON" do
            vg_json = vg_result_scope.call(subject.convert)
            expect(vg_json[:physicalVolumes]).to eq(
              [
                "pv1",
                "pv2",
                { generate: ["disk1"] }
              ]
            )
          end

          context "and #physical_volumes_encryption is configured" do
            let(:volume_group) do
              {
                physicalVolumes: [
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
              }
            end

            it "generates the expected JSON" do
              vg_json = vg_result_scope.call(subject.convert)
              expect(vg_json[:physicalVolumes]).to eq(
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

      context "if #logical_volumes is configured for a volume group" do
        let(:volume_group) { { logicalVolumes: logical_volumes } }

        let(:logical_volumes) do
          [
            logical_volume,
            { name: "lv2" }
          ]
        end

        let(:logical_volume) { { name: "lv1" } }

        it "generates the expected JSON" do
          config_json = vg_result_scope.call(subject.convert)
          expect(config_json[:logicalVolumes]).to eq(
            [
              {
                name: "lv1",
                pool: false
              },
              {
                name: "lv2",
                pool: false
              }
            ]
          )
        end

        lv_result_scope = proc { |c| vg_result_scope.call(c)[:logicalVolumes].first }
        lv_scope = proc { |c| vg_scope.call(c).logical_volumes.first }

        context "if #name is not configured for a logical volume" do
          let(:logical_volume) { {} }

          it "generates the expected JSON" do
            lv_json = lv_result_scope.call(subject.convert)
            expect(lv_json.keys).to_not include(:name)
          end
        end

        context "if #stripes is not configured for a logical volume" do
          let(:logical_volume) { {} }

          it "generates the expected JSON" do
            lv_json = lv_result_scope.call(subject.convert)
            expect(lv_json.keys).to_not include(:stripes)
          end
        end

        context "if #stripe_size is not configured for a logical volume" do
          let(:logical_volume) { {} }

          it "generates the expected JSON" do
            lv_json = lv_result_scope.call(subject.convert)
            expect(lv_json.keys).to_not include(:stripeSize)
          end
        end

        context "if #pool is not configured for a logical volume" do
          let(:logical_volume) { {} }

          it "generates the expected JSON" do
            lv_json = lv_result_scope.call(subject.convert)
            expect(lv_json[:pool]).to eq(false)
          end
        end

        context "if #used_pool is not configured for a logical volume" do
          let(:logical_volume) { {} }

          it "generates the expected JSON" do
            lv_json = lv_result_scope.call(subject.convert)
            expect(lv_json.keys).to_not include(:usedPool)
          end
        end

        context "if #alias is not configured for a logical volume" do
          let(:logical_volume) { {} }
          include_examples "without alias", lv_result_scope
        end

        context "if #size is not configured for a logical volume" do
          let(:logical_volume) { {} }
          include_examples "without size", lv_result_scope
        end

        context "if #encryption is not configured for a logical volume" do
          let(:logical_volume) { {} }
          include_examples "without encryption", lv_result_scope
        end

        context "if #filesystem is not configured for a logical volume" do
          let(:logical_volume) { {} }
          include_examples "without filesystem", lv_result_scope
        end

        context "if #stripes is configured for a logical volume" do
          let(:logical_volume) { { stripes: 10 } }

          it "generates the expected JSON" do
            lv_json = lv_result_scope.call(subject.convert)
            expect(lv_json[:stripes]).to eq(10)
          end
        end

        context "if #stripe_size is configured for a logical volume" do
          let(:logical_volume) { { stripeSize: "4 KiB" } }

          it "generates the expected JSON" do
            lv_json = lv_result_scope.call(subject.convert)
            expect(lv_json[:stripeSize]).to eq(4.KiB.to_i)
          end
        end

        context "if #pool is configured for a logical volume" do
          let(:logical_volume) { { pool: true } }

          it "generates the expected JSON" do
            lv_json = lv_result_scope.call(subject.convert)
            expect(lv_json[:pool]).to eq(true)
          end
        end

        context "if #used_pool is configured for a logical volume" do
          let(:logical_volume) { { usedPool: "pool" } }

          it "generates the expected JSON" do
            lv_json = lv_result_scope.call(subject.convert)
            expect(lv_json[:usedPool]).to eq("pool")
          end
        end

        context "if #alias is configured for a logical volume" do
          let(:logical_volume) { { alias: device_alias } }
          include_examples "with alias", lv_result_scope
        end

        context "if #size is configured for a logical volume" do
          let(:logical_volume) { { size: size } }
          include_examples "with size", lv_result_scope, lv_scope
        end

        context "if #encryption is configured for a logical volume" do
          let(:logical_volume) { { encryption: encryption } }
          include_examples "with encryption", lv_result_scope
        end

        context "if #filesystem is configured for a logical volume" do
          let(:logical_volume) { { filesystem: filesystem } }
          include_examples "with filesystem", lv_result_scope
        end
      end
    end
  end
end
