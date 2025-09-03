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

require_relative "../storage_helpers"
require "agama/config"
require "agama/storage/config_conversions/from_json"
require "agama/storage/config_solvers/boot"
require "agama/storage/system"

describe Agama::Storage::ConfigSolvers::Boot do
  subject { described_class.new(product_config, storage_system) }

  let(:product_config) { Agama::Config.new({}) }
  let(:storage_system) { Agama::Storage::System.new }

  describe "#solve" do
    let(:config_json) { nil }

    let(:config) do
      Agama::Storage::ConfigConversions::FromJSON
        .new(config_json)
        .convert
    end

    context "if a config does not specify the boot device alias" do
      let(:config_json) do
        {
          boot:         { configure: configure_boot },
          drives:       drives,
          mdRaids:      md_raids,
          volumeGroups: volume_groups
        }
      end

      let(:drives) { [] }
      let(:md_raids) { [] }
      let(:volume_groups) { [] }

      context "and boot is not set to be configured" do
        let(:configure_boot) { false }

        it "does not set a boot device alias" do
          subject.solve(config)
          expect(config.boot.device.device_alias).to be_nil
        end
      end

      context "and boot is set to be configured" do
        let(:configure_boot) { true }

        context "and the boot device is not set to default" do
          before do
            config.boot.device.default = false
          end

          it "does not set a boot device alias" do
            subject.solve(config)
            expect(config.boot.device.device_alias).to be_nil
          end
        end

        context "and the boot device is set to default" do
          before do
            config.boot.device.default = true
          end

          context "and there is a drive containing a root partition" do
            let(:drives) do
              [
                {
                  alias:      device_alias,
                  partitions: [
                    {
                      filesystem: { path: "/" }
                    }
                  ]
                }
              ]
            end

            let(:device_alias) { "root" }

            it "sets the alias of the root device as boot device alias" do
              subject.solve(config)
              expect(config.boot.device.device_alias).to eq("root")
            end

            context "and the root device has no alias" do
              let(:device_alias) { nil }

              it "sets an alias to the root device" do
                subject.solve(config)
                drive = config.drives.first
                expect(drive.alias).to_not be_nil
              end

              it "sets the alias of the root device as boot device alias" do
                subject.solve(config)
                drive = config.drives.first
                expect(config.boot.device.device_alias).to eq(drive.alias)
              end
            end
          end

          context "and there is a MD RAID containing a root partition" do
            let(:md_raids) do
              [
                {
                  alias:      raid_alias,
                  partitions: [
                    {
                      filesystem: { path: "/" }
                    }
                  ],
                  devices:    md_devices
                }
              ]
            end

            let(:raid_alias) { "raid" }
            let(:device_alias) { "root" }
            let(:md_devices) { [] }

            context "and a partition is used as MD RAID device member" do
              let(:drives) do
                [
                  {
                    alias:      device_alias,
                    partitions: [
                      { alias: "p1" }
                    ]
                  },
                  { alias: "disk2" }
                ]
              end

              let(:device_alias) { "disk1" }

              let(:md_devices) { ["disk2", "p1"] }

              it "sets the alias of the drive as boot device alias" do
                subject.solve(config)
                expect(config.boot.device.device_alias).to eq("disk1")
              end

              context "and the drive has no alias" do
                let(:device_alias) { nil }

                it "sets an alias to the drive" do
                  subject.solve(config)
                  drive = config.drives.first
                  expect(drive.alias).to_not be_nil
                end

                it "sets the alias of the drive device as boot device alias" do
                  subject.solve(config)
                  drive = config.drives.first
                  expect(config.boot.device.device_alias).to eq(drive.alias)
                end
              end
            end

            context "and whole disks are used as MD RAID device members" do
              let(:drives) do
                [
                  { alias: "disk1" },
                  { alias: "disk2" }
                ]
              end

              let(:md_devices) { ["disk1", "disk2"] }

              it "does not set a boot device alias" do
                subject.solve(config)
                expect(config.boot.device.device_alias).to be_nil
              end
            end

            context "and it corresponds to an existing (reused) RAID" do
              let(:md_device) { instance_double(Y2Storage::Md) }

              before do
                allow(config.md_raids.first).to receive(:found_device).and_return md_device
                allow(storage_system).to receive(:candidate?).with(md_device).and_return candidate
              end

              context "if the RAID is considered bootable (candidate)" do
                let(:candidate) { true }

                it "sets the alias of the mdRaid as boot device alias" do
                  subject.solve(config)
                  expect(config.boot.device.device_alias).to eq("raid")
                end

                context "and the mdRaid configuration has no alias" do
                  let(:raid_alias) { nil }

                  it "sets an alias to the mdRaid" do
                    subject.solve(config)
                    raid = config.md_raids.first
                    expect(raid.alias).to_not be_nil
                  end

                  it "sets the alias of the mdRaid as boot device alias" do
                    subject.solve(config)
                    raid = config.md_raids.first
                    expect(config.boot.device.device_alias).to eq(raid.alias)
                  end
                end
              end

              context "if the RAID is a regular one (not candidate)" do
                let(:candidate) { false }

                it "does not set a boot device alias" do
                  subject.solve(config)
                  expect(config.boot.device.device_alias).to be_nil
                end
              end
            end
          end

          context "and there is a root logical volume" do
            let(:volume_groups) do
              [
                {
                  name:            "system",
                  physicalVolumes: physical_volumes,
                  logicalVolumes:  [
                    {
                      filesystem: { path: "/" }
                    }
                  ]
                }
              ]
            end

            context "and there is a drive as target for physical volumes" do
              let(:drives) do
                [
                  { alias: "disk1" },
                  { alias: "disk2" }
                ]
              end

              let(:physical_volumes) { [{ generate: ["disk2", "disk1"] }] }

              it "sets the alias of the first target drive as boot device alias" do
                subject.solve(config)
                expect(config.boot.device.device_alias).to eq("disk2")
              end
            end

            context "and there is a MD RAID as target for physical volumes" do
              let(:md_raids) do
                [
                  {
                    alias:   "md1",
                    devices: ["p1"]
                  }
                ]
              end

              let(:drives) do
                [
                  {
                    alias:      "disk1",
                    partitions: [
                      { alias: "p1" }
                    ]
                  }
                ]
              end

              let(:physical_volumes) { [{ generate: ["md1"] }] }

              it "sets the alias of the first drive used as MD RAID member as boot device alias" do
                subject.solve(config)
                expect(config.boot.device.device_alias).to eq("disk1")
              end
            end

            context "and there is no target device for physical volumes" do
              let(:drives) do
                [
                  {
                    alias:      "disk1",
                    partitions: [
                      { alias: "p1" }
                    ]
                  },
                  {
                    alias:      device_alias,
                    partitions: [
                      { alias: "p2" }
                    ]
                  },
                  { alias: "disk3" }
                ]
              end

              let(:device_alias) { "disk2" }

              context "and there is any partition as physical volume" do
                let(:physical_volumes) { ["disk3", "p2", "p1"] }

                it "sets the alias of the drive of the first partition as boot device alias" do
                  subject.solve(config)
                  expect(config.boot.device.device_alias).to eq("disk2")
                end

                context "and the drive of the first partition has no alias" do
                  let(:device_alias) { nil }

                  it "sets an alias to the drive" do
                    subject.solve(config)
                    drive = config.drives[1]
                    expect(drive.alias).to_not be_nil
                  end

                  it "sets the alias of the drive as boot device alias" do
                    subject.solve(config)
                    drive = config.drives[1]
                    expect(config.boot.device.device_alias).to eq(drive.alias)
                  end
                end
              end

              context "and there is no partition as physical volume" do
                let(:physical_volumes) { ["disk1", "disk2"] }

                it "does not set a boot device alias" do
                  subject.solve(config)
                  expect(config.boot.device.device_alias).to be_nil
                end
              end
            end
          end

          context "and there is neither a partition nor a logical volume for root" do
            let(:drives) do
              [
                {
                  alias:      "disk1",
                  partitions: [
                    {
                      filesystem: { path: "/test1" }
                    }
                  ]
                }
              ]
            end

            let(:md_raids) do
              [
                {
                  alias:      "md1",
                  partitions: [
                    {
                      filesystem: { path: "/test2" }
                    }
                  ]
                }
              ]
            end

            let(:volume_groups) do
              [
                {
                  name:            "system",
                  physicalVolumes: [{ generate: ["disk1"] }],
                  logicalVolumes:  [
                    {
                      filesystem: { path: "/test3" }
                    }
                  ]
                }
              ]
            end

            it "does not set a boot device alias" do
              subject.solve(config)
              expect(config.boot.device.device_alias).to be_nil
            end
          end
        end
      end
    end
  end
end
