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
require "agama/storage/config_solvers"
require "agama/storage/system"

describe Agama::Storage::ConfigSolvers::Boot do
  include Agama::RSpec::StorageHelpers

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
              before do
                mock_storage(devicegraph: scenario)
                allow(config.md_raids.first).to receive(:found_device).and_return md_device
              end

              let(:scenario) { "md_raids.yaml" }
              let(:devicegraph) { Y2Storage::StorageManager.instance.probed }
              let(:md_device) { devicegraph.find_by_name("/dev/md0") }

              context "if the RAID is considered bootable (candidate)" do
                before do
                  allow(storage_system).to receive(:candidate?).with(md_device).and_return true
                end

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
                context "directly over full disks" do
                  let(:scenario) { "md_disks.yaml" }

                  it "does not set a boot device alias" do
                    subject.solve(config)
                    expect(config.boot.device.device_alias).to be_nil
                  end
                end

                context "defined over partitions of some disks" do
                  before do
                    # These complex cases would need a lot of mocking if we do not resolve searches
                    # first in order to connect the definitions and the devicegraph.
                    Agama::Storage::ConfigSolvers::DrivesSearch.new(storage_system)
                      .solve(config)
                    Agama::Storage::ConfigSolvers::MdRaidsSearch.new(storage_system)
                      .solve(config)
                    Agama::Storage::ConfigSolvers::VolumeGroupsSearch.new(storage_system)
                      .solve(config)
                  end

                  context "with no drive entries for the underlying disks" do
                    let(:drives) { [] }

                    it "creates a drive entry for the first disk of the RAID members" do
                      subject.solve(config)
                      drive = config.drives.first
                      expect(drive.found_device.descendants).to include md_device
                      # Check the first disk (by name) is consistently choosen
                      expect(drive.found_device.name).to eq "/dev/vda"
                      expect(drive.alias).to_not be_nil
                    end

                    it "sets the alias of the drive device as boot device alias" do
                      subject.solve(config)
                      drive = config.drives.first
                      expect(config.boot.device.device_alias).to eq(drive.alias)
                    end

                    context "if none of the disks is a candidate for installation" do
                      before do
                        allow(storage_system).to receive(:candidate?).and_return false
                      end

                      it "does not set a boot device alias" do
                        subject.solve(config)
                        expect(config.boot.device.device_alias).to be_nil
                      end
                    end
                  end

                  context "with drive entries for the underlying disks" do
                    let(:drives) do
                      [
                        {
                          search: "/dev/vdb",
                          alias:  "vdb-as-first"
                        },
                        {
                          alias:      "data",
                          partitions: [
                            {
                              filesystem: { path: "/data" },
                              size:       "50 GiB"
                            }
                          ]
                        }
                      ]
                    end

                    it "solves the boot device using the first usable drive" do
                      subject.solve(config)
                      expect(config.boot.device.device_alias).to eq("vdb-as-first")
                    end

                    context "if none of the disks is a candidate for installation" do
                      before do
                        allow(storage_system).to receive(:candidate?).and_return false
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

          context "and an existing LVM volume group is reused for root" do
            before do
              mock_storage(devicegraph: scenario)

              # These complex cases would need a lot of mocking if we do not resolve searches
              # first in order to connect the definitions and the devicegraph.
              Agama::Storage::ConfigSolvers::DrivesSearch.new(storage_system)
                .solve(config)
              Agama::Storage::ConfigSolvers::MdRaidsSearch.new(storage_system)
                .solve(config)
              Agama::Storage::ConfigSolvers::VolumeGroupsSearch.new(storage_system)
                .solve(config)
            end

            let(:volume_groups) do
              [
                {
                  search:         vg_name,
                  logicalVolumes: [
                    { filesystem: { path: "/" } }
                  ]
                }
              ]
            end

            RSpec.shared_examples "no alias" do
              it "does not set a boot device alias" do
                subject.solve(config)
                expect(config.boot.device.device_alias).to be_nil
              end
            end

            RSpec.shared_examples "no alias if no candidate disk" do
              context "if none of the disks is a candidate for installation" do
                before do
                  allow(storage_system).to receive(:candidate?).and_return false
                end

                include_examples "no alias"
              end
            end

            RSpec.shared_examples "set alias" do
              it "sets the alias of the drive device as boot device alias" do
                subject.solve(config)
                drive = config.drives.first
                expect(config.boot.device.device_alias).to eq(drive.alias)
              end
            end

            context "and the physical volumes are full disks" do
              let(:scenario) { "lvm_with_nested_thin_lvs.xml" }
              let(:vg_name) { "/dev/vg_b" }

              context "with no drive entries for the underlying disks" do
                let(:drives) { [] }

                include_examples "no alias"
              end

              context "with drive entries for the underlying disks" do
                let(:drives) do
                  [
                    {
                      search: "/dev/sdd",
                      alias:  "sdd"
                    }
                  ]
                end

                include_examples "no alias"
              end
            end

            context "and the physical volumes are partitions on disks" do
              let(:scenario) { "several_vgs.yaml" }
              let(:vg_name) { "/dev/data" }

              context "with no drive entries for the underlying disks" do
                let(:drives) { [] }

                it "creates a drive entry for the first disk of the RAID members" do
                  subject.solve(config)
                  drive = config.drives.first
                  # Check the first disk (by name) is consistently choosen
                  expect(drive.found_device.name).to eq "/dev/sda"
                  expect(drive.alias).to_not be_nil
                end

                include_examples "set alias"
                include_examples "no alias if no candidate disk"
              end

              context "with drive entries for some of the underlying disks" do
                let(:drives) do
                  [
                    {
                      search: "/dev/sdb",
                      alias:  "sdb"
                    }
                  ]
                end

                it "solves the boot device using the first usable drive" do
                  subject.solve(config)
                  expect(config.boot.device.device_alias).to eq("sdb")
                end

                include_examples "no alias if no candidate disk"
              end
            end

            context "and some physical volumes are software RAIDs on top of partitioned disks" do
              let(:scenario) { "lvm-over-raids.yaml" }
              let(:vg_name) { "/dev/vg0" }

              context "with no drive entries for the underlying disks" do
                let(:drives) { [] }

                it "creates a drive entry for the first partitioned disk of the RAID members" do
                  subject.solve(config)
                  drive = config.drives.first
                  expect(drive.found_device.name).to eq "/dev/vda"
                  expect(drive.alias).to_not be_nil
                end

                include_examples "set alias"
                include_examples "no alias if no candidate disk"
              end

              context "with drive entries for some of the underlying disks" do
                let(:drives) do
                  [
                    {
                      search: "/dev/vdc",
                      alias:  "vdc"
                    },
                    {
                      search: "/dev/vda",
                      alias:  "vda"
                    }
                  ]
                end

                it "solves the boot device using the first usable drive" do
                  subject.solve(config)
                  # vdc cannot be chosen because it is fully used as RAID member, no partitions
                  expect(config.boot.device.device_alias).to eq("vda")
                end

                include_examples "no alias if no candidate disk"
              end
            end

            context "and all physical volumes are software RAIDs on top of full disks" do
              let(:scenario) { "lvm-over-raids.yaml" }
              let(:vg_name) { "/dev/vg1" }

              context "with no drive entries for the underlying disks" do
                let(:drives) { [] }

                include_examples "no alias"
              end

              context "with drive entries for the underlying disks" do
                let(:drives) do
                  [
                    {
                      search: "/dev/vde",
                      alias:  "vde"
                    },
                    {
                      search: "/dev/vdf",
                      alias:  "vdf"
                    }
                  ]
                end

                include_examples "no alias"
              end
            end

            context "and the physical volumes are BIOS RAIDs and partitions on top of them" do
              let(:scenario) { "lvm-over-hardware-raid.xml" }
              let(:vg_name) { "/dev/system" }

              context "with no mdRaid or drive entries for the underlying devices" do
                let(:drives) { [] }
                let(:mdRaids) { [] }

                it "creates an mdRaid entry for the first partitioned RAID" do
                  subject.solve(config)
                  raid = config.md_raids.first
                  expect(raid.found_device.name).to eq "/dev/md/a"
                  expect(raid.alias).to_not be_nil
                end

                it "sets the alias of the RAID as boot device alias" do
                  subject.solve(config)
                  raid = config.md_raids.first
                  expect(config.boot.device.device_alias).to eq(raid.alias)
                end
              end

              context "with drive entries for some of the underlying RAIDs" do
                let(:drives) do
                  [
                    {
                      search: "/dev/md/b",
                      alias:  "raid-b"
                    },
                    {
                      search: "/dev/md/a",
                      alias:  "raid-a"
                    }
                  ]
                end

                it "solves the boot device using the first usable drive" do
                  subject.solve(config)
                  # md/b cannot be chosen because it is fully used as physical volume, no partitions
                  expect(config.boot.device.device_alias).to eq("raid-a")
                end

                include_examples "no alias if no candidate disk"
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
