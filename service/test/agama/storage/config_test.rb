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

require_relative "./storage_helpers"
require "agama/config"
require "agama/storage/config_conversions"

describe Agama::Storage::Config do
  include Agama::RSpec::StorageHelpers

  subject do
    Agama::Storage::ConfigConversions::FromJSON
      .new(config_json)
      .convert
  end

  describe "#boot_device" do
    context "if boot config is not set to be configured" do
      let(:config_json) do
        {
          boot:   {
            configure: false,
            device:    "boot"
          },
          drives: [
            { alias: "boot" }
          ]
        }
      end

      it "returns nil" do
        expect(subject.boot_device).to be_nil
      end
    end

    context "if boot config is set to be configured" do
      let(:config_json) do
        {
          boot:    {
            configure: true,
            device:    device_alias
          },
          drives:  [
            {
              alias:      "disk1",
              partitions: [
                { alias: "part1" }
              ]
            }
          ],
          mdRaids: [
            { alias: "raid1" }
          ]
        }
      end

      context "and boot config has not a device alias" do
        let(:device_alias) { nil }

        it "returns nil" do
          expect(subject.boot_device).to be_nil
        end
      end

      context "and boot config has a device alias" do
        context "and there is a drive config with the boot device alias" do
          let(:device_alias) { "disk1" }

          it "returns the drive config" do
            expect(subject.boot_device).to be_a(Agama::Storage::Configs::Drive)
            expect(subject.boot_device.alias).to eq("disk1")
          end
        end

        context "and there is an mdRaid config with the boot device alias" do
          let(:device_alias) { "raid1" }

          it "returns the mdRaid config" do
            expect(subject.boot_device).to be_a(Agama::Storage::Configs::MdRaid)
            expect(subject.boot_device.alias).to eq("raid1")
          end
        end

        context "and there is not a drive or mdRaid config with the boot device alias" do
          let(:device_alias) { "part1" }

          it "returns nil" do
            expect(subject.boot_device).to be_nil
          end
        end
      end
    end
  end

  describe "#root_drive" do
    let(:config_json) do
      {
        drives:       [
          { alias: "disk1" },
          drive
        ],
        volumeGroups: [
          {
            name:           "vg1",
            logicalVolumes: [
              {
                filesystem: { path: "/" }
              }
            ]
          }
        ]
      }
    end

    context "if there is a drive used for root" do
      let(:drive) do
        {
          alias:      "disk2",
          filesystem: { path: "/" }
        }
      end

      it "returns the drive" do
        expect(subject.root_drive).to be_a(Agama::Storage::Configs::Drive)
        expect(subject.root_drive.alias).to eq("disk2")
      end
    end

    context "if there is a drive containing a partition used for root" do
      let(:drive) do
        {
          alias:      "disk2",
          partitions: [
            {
              alias:      "part1",
              filesystem: { path: "/" }
            }
          ]
        }
      end

      it "returns the drive" do
        expect(subject.root_drive).to be_a(Agama::Storage::Configs::Drive)
        expect(subject.root_drive.alias).to eq("disk2")
      end
    end

    context "if there is neither root drive nor root partition" do
      let(:drive) { {} }

      it "returns nil" do
        expect(subject.root_drive).to be_nil
      end
    end
  end

  describe "#root_md_raid" do
    let(:config_json) do
      {
        drives:  [
          {
            alias:      "disk1",
            partitions: [
              {
                filesystem: { path: "/" }
              }
            ]
          }
        ],
        mdRaids: [
          md_raid
        ]
      }
    end

    context "if there is a MD RAID used for root" do
      let(:md_raid) do
        {
          alias:      "md1",
          filesystem: { path: "/" }
        }
      end

      it "returns the MD RAID" do
        expect(subject.root_md_raid).to be_a(Agama::Storage::Configs::MdRaid)
        expect(subject.root_md_raid.alias).to eq("md1")
      end
    end

    context "if there is a MD RAID containing a partition used for root" do
      let(:md_raid) do
        {
          alias:      "md1",
          partitions: [
            {
              filesystem: { path: "/" }
            }
          ]
        }
      end

      it "returns the MD RAID" do
        expect(subject.root_md_raid).to be_a(Agama::Storage::Configs::MdRaid)
        expect(subject.root_md_raid.alias).to eq("md1")
      end
    end

    context "if there is neither root MD RAID nor root partition" do
      let(:md_raid) { {} }

      it "returns nil" do
        expect(subject.root_md_raid).to be_nil
      end
    end
  end

  describe "#root_volume_group" do
    let(:config_json) do
      {
        drives:       [
          {
            partitions: [
              {
                alias:      "part1",
                filesystem: { path: "/" }
              }
            ]
          }
        ],
        volumeGroups: [
          {
            name:           "vg1",
            logicalVolumes: [
              {
                filesystem: { path: "/home" }
              }
            ]
          },
          volume_group
        ]
      }
    end

    context "if there is a volume group containing a logical volume used for root" do
      let(:volume_group) do
        {
          name:           "vg2",
          logicalVolumes: [
            {
              filesystem: { path: "/" }
            }
          ]
        }
      end

      it "returns the volume group" do
        expect(subject.root_volume_group).to be_a(Agama::Storage::Configs::VolumeGroup)
        expect(subject.root_volume_group.name).to eq("vg2")
      end
    end

    context "if there is not a volume group containing a logical volume used for root" do
      let(:volume_group) { { name: "vg2" } }

      it "returns nil" do
        expect(subject.root_volume_group).to be_nil
      end
    end
  end

  describe "#drive" do
    let(:config_json) do
      {
        drives: [
          {
            alias:      "disk1",
            partitions: [
              { alias: "part1" }
            ]
          },
          {
            alias:      "disk2",
            partitions: [
              { alias: "part2" }
            ]
          }
        ]
      }
    end

    context "if there is a drive with the given alias" do
      let(:device_alias) { "disk1" }

      it "returns the drive" do
        drive = subject.drive(device_alias)

        expect(drive).to be_a(Agama::Storage::Configs::Drive)
        expect(drive.alias).to eq(device_alias)
      end
    end

    context "if there is not a drive with the given alias" do
      let(:device_alias) { "part1" }

      it "returns nil" do
        drive = subject.drive(device_alias)

        expect(drive).to be_nil
      end
    end
  end

  describe "#md_raid" do
    let(:config_json) do
      {
        mdRaids: [
          {
            alias:      "md1",
            partitions: [
              { alias: "part1" }
            ]
          },
          {
            alias:      "md2",
            partitions: [
              { alias: "part2" }
            ]
          }
        ]
      }
    end

    context "if there is a MD RAID with the given alias" do
      let(:device_alias) { "md1" }

      it "returns the MD RAID" do
        md_raid = subject.md_raid(device_alias)

        expect(md_raid).to be_a(Agama::Storage::Configs::MdRaid)
        expect(md_raid.alias).to eq(device_alias)
      end
    end

    context "if there is not a MD RAID with the given alias" do
      let(:device_alias) { "part1" }

      it "returns nil" do
        md_raid = subject.md_raid(device_alias)

        expect(md_raid).to be_nil
      end
    end
  end

  describe "#partitionable" do
    let(:config_json) do
      {
        drives:  [
          { alias: "disk1" },
          { alias: "disk2" }
        ],
        mdRaids: [
          { alias: "md1" },
          { alias: "md2" }
        ]
      }
    end

    context "if there is a drive with the given alias" do
      let(:device_alias) { "disk2" }

      it "returns the drive" do
        device = subject.partitionable(device_alias)

        expect(device).to be_a(Agama::Storage::Configs::Drive)
        expect(device.alias).to eq(device_alias)
      end
    end

    context "if there is a MD RAID with the given alias" do
      let(:device_alias) { "md1" }

      it "returns the MD RAID" do
        device = subject.partitionable(device_alias)

        expect(device).to be_a(Agama::Storage::Configs::MdRaid)
        expect(device.alias).to eq(device_alias)
      end
    end

    context "if there is neither a drive nor a MD RAID with the given alias" do
      let(:device_alias) { "part1" }

      it "returns nil" do
        device = subject.partitionable(device_alias)

        expect(device).to be_nil
      end
    end
  end

  describe "#partitions" do
    let(:config_json) do
      {
        drives:  [
          {
            partitions: [
              { alias: "p1" },
              { alias: "p2" }
            ]
          }
        ],
        mdRaids: [
          {
            partitions: [
              { alias: "p3" }
            ]
          }
        ]
      }
    end

    it "returns all partitions" do
      partitions = subject.partitions

      expect(partitions.size).to eq(3)
      expect(partitions.map(&:alias)).to contain_exactly("p1", "p2", "p3")
    end
  end

  describe "#logical_volumes" do
    let(:config_json) do
      {
        volumeGroups: [
          {
            logicalVolumes: [
              { name: "lv1" },
              { name: "lv2" }
            ]
          },
          {
            logicalVolumes: [
              { name: "lv3" }
            ]
          }
        ]
      }
    end

    it "returns all logical volumes" do
      logical_volumes = subject.logical_volumes

      expect(logical_volumes.size).to eq(3)
      expect(logical_volumes.map(&:name)).to contain_exactly("lv1", "lv2", "lv3")
    end
  end

  describe "#filesystems" do
    let(:config_json) do
      {
        drives:       [
          {
            filesystem: { path: "/test1" }
          },
          {
            partitions: [
              {
                filesystem: { path: "/test2" }
              },
              {
                filesystem: { path: "/test3" }
              }
            ]
          }
        ],
        volumeGroups: [
          {
            logicalVolumes: [
              {
                filesystem: { path: "/test4" }
              }
            ]
          }
        ],
        mdRaids:      [
          {
            filesystem: { path: "/test5" }
          },
          {
            partitions: [
              {
                filesystem: { path: "/test6" }
              },
              {
                filesystem: { path: "/test7" }
              }
            ]
          }
        ]
      }
    end

    it "returns all filesystems" do
      filesystems = subject.filesystems

      expect(filesystems.size).to eq(7)
      expect(filesystems.map(&:path))
        .to contain_exactly("/test1", "/test2", "/test3", "/test4", "/test5", "/test6", "/test7")
    end
  end

  describe "#supporting_search" do
    let(:config_json) do
      {
        drives:       [
          {},
          {
            partitions: [
              {}
            ]
          }
        ],
        volumeGroups: [
          {
            logicalVolumes: [
              {}
            ]
          }
        ],
        mdRaids:      [
          {},
          {
            partitions: [
              {}
            ]
          }
        ]
      }
    end

    it "returns all configs with configurable search" do
      configs = subject.supporting_search
      expect(configs.size).to eq(6)
    end

    it "includes all drives" do
      expect(subject.supporting_search).to include(*subject.drives)
    end

    it "includes all MD RAIDs" do
      expect(subject.supporting_search).to include(*subject.md_raids)
    end

    it "includes all partitions" do
      expect(subject.supporting_search).to include(*subject.partitions)
    end
  end

  describe "#supporting_encryption" do
    let(:config_json) do
      {
        drives:       [
          {},
          {
            partitions: [
              {}
            ]
          }
        ],
        volumeGroups: [
          {
            logicalVolumes: [
              {}
            ]
          }
        ],
        mdRaids:      [
          {},
          {
            partitions: [
              {}
            ]
          }
        ]
      }
    end

    it "returns all configs with configurable encryption" do
      configs = subject.supporting_encryption
      expect(configs.size).to eq(7)
    end

    it "includes all drives" do
      expect(subject.supporting_encryption).to include(*subject.drives)
    end

    it "includes all MD RAIDs" do
      expect(subject.supporting_encryption).to include(*subject.md_raids)
    end

    it "includes all partitions" do
      expect(subject.supporting_encryption).to include(*subject.partitions)
    end

    it "includes all logical volumes" do
      expect(subject.supporting_encryption).to include(*subject.logical_volumes)
    end

    it "does not include volume groups" do
      expect(subject.supporting_encryption).to_not include(*subject.volume_groups)
    end
  end

  describe "#supporting_filesystem" do
    let(:config_json) do
      {
        drives:       [
          {},
          {
            partitions: [
              {}
            ]
          }
        ],
        volumeGroups: [
          {
            logicalVolumes: [
              {}
            ]
          }
        ],
        mdRaids:      [
          {},
          {
            partitions: [
              {}
            ]
          }
        ]
      }
    end

    it "returns all configs with configurable filesystem" do
      configs = subject.supporting_filesystem
      expect(configs.size).to eq(7)
    end

    it "includes all drives" do
      expect(subject.supporting_filesystem).to include(*subject.drives)
    end

    it "includes all MD RAIDs" do
      expect(subject.supporting_filesystem).to include(*subject.md_raids)
    end

    it "includes all partitions" do
      expect(subject.supporting_filesystem).to include(*subject.partitions)
    end

    it "includes all logical volumes" do
      expect(subject.supporting_filesystem).to include(*subject.logical_volumes)
    end

    it "does not include volume groups" do
      expect(subject.supporting_filesystem).to_not include(*subject.volume_groups)
    end
  end

  describe "#supporting_size" do
    let(:config_json) do
      {
        drives:       [
          {},
          {
            partitions: [
              {}
            ]
          }
        ],
        volumeGroups: [
          {
            logicalVolumes: [
              {}
            ]
          }
        ],
        mdRaids:      [
          {},
          {
            partitions: [
              {}
            ]
          }
        ]
      }
    end

    it "returns all configs with configurable size" do
      configs = subject.supporting_size
      expect(configs.size).to eq(3)
    end

    it "includes all partitions" do
      expect(subject.supporting_size).to include(*subject.partitions)
    end

    it "includes all logical volumes" do
      expect(subject.supporting_size).to include(*subject.logical_volumes)
    end

    it "does not include drives" do
      expect(subject.supporting_size).to_not include(*subject.drives)
    end

    it "does not include MD RAIDs" do
      expect(subject.supporting_size).to_not include(*subject.md_raids)
    end

    it "does not include volume groups" do
      expect(subject.supporting_size).to_not include(*subject.volume_groups)
    end
  end

  describe "#supporting_partitions" do
    let(:config_json) do
      {
        drives:       [
          {},
          {
            partitions: [
              {}
            ]
          }
        ],
        volumeGroups: [
          {
            logicalVolumes: [
              {}
            ]
          }
        ],
        mdRaids:      [
          {},
          {
            partitions: [
              {}
            ]
          }
        ]
      }
    end

    it "returns all configs with configurable partitions" do
      configs = subject.supporting_partitions
      expect(configs.size).to eq(4)
    end

    it "includes all drives" do
      expect(subject.supporting_partitions).to include(*subject.drives)
    end

    it "includes all MD RAIDs" do
      expect(subject.supporting_partitions).to include(*subject.md_raids)
    end
  end

  describe "#potential_for_md_device" do
    let(:config_json) do
      {
        drives:       [
          {
            alias:      "disk1",
            partitions: [
              { alias: "p1" },
              { alias: "p2" }
            ]
          },
          {
            alias: "disk2"
          }
        ],
        mdRaids:      [
          {
            alias:      "md1",
            partitions: [
              { alias: "p3" }
            ]
          }
        ],
        volumeGroups: [
          logicalVolumes: [
            { alias: "lv1" }
          ]
        ]
      }
    end

    it "returns the drives and partitions from drives" do
      configs = subject.potential_for_md_device
      expect(configs.map(&:alias)).to contain_exactly("disk1", "disk2", "p1", "p2")
    end
  end

  describe "#users" do
    shared_examples "drive users" do |device_alias|
      let(:config_json) do
        {
          drives:       [
            drive,
            { alias: "disk2" }
          ],
          mdRaids:      md_raids,
          volumeGroups: volume_groups
        }
      end

      let(:md_raids) { nil }
      let(:volume_groups) { nil }

      context "and it is used as MD member device" do
        let(:md_raids) do
          [
            { devices: [device_alias] },
            { devices: ["disk2"] }
          ]
        end

        it "returns the MD RAID" do
          users = subject.users(device_alias)
          expect(users).to contain_exactly(subject.md_raids.first)
        end
      end

      context "and it is used as physical volume" do
        let(:volume_groups) do
          [
            { physicalVolumes: [device_alias] },
            { physicalVolumes: ["disk2"] }
          ]
        end

        it "returns the volume group" do
          users = subject.users(device_alias)
          expect(users).to contain_exactly(subject.volume_groups.first)
        end
      end

      context "and it is used as MD RAID member and physical volume" do
        let(:md_raids) do
          [
            { devices: [device_alias] },
            { devices: ["disk2"] }
          ]
        end

        let(:volume_groups) do
          [
            { physicalVolumes: [device_alias] },
            { physicalVolumes: ["disk2"] }
          ]
        end

        it "returns the MD RAID and the volume group" do
          users = subject.users(device_alias)
          expect(users).to contain_exactly(
            subject.md_raids.first,
            subject.volume_groups.first
          )
        end
      end

      context "and it is not used neither as MD RAID member nor physical volume" do
        let(:md_raids) do
          [
            { devices: [] },
            { devices: ["disk2"] }
          ]
        end

        let(:volume_groups) do
          [
            { physicalVolumes: [] },
            { physicalVolumes: ["disk2"] }
          ]
        end

        it "returns an empty list" do
          users = subject.users(device_alias)
          expect(users).to eq([])
        end
      end
    end

    shared_examples "md users" do |device_alias|
      let(:config_json) do
        {
          mdRaids:      [
            md_raid,
            { alias: "md2" }
          ],
          volumeGroups: volume_groups
        }
      end

      let(:volume_groups) { nil }

      context "and it is used as physical volume" do
        let(:volume_groups) do
          [
            { physicalVolumes: [device_alias] },
            { physicalVolumes: ["md2"] }
          ]
        end

        it "returns the volume group" do
          users = subject.users(device_alias)
          expect(users).to contain_exactly(subject.volume_groups.first)
        end
      end

      context "and it is used as MD member device" do
        let(:config_json) do
          {
            mdRaids: [
              md_raid,
              { devices: [device_alias] }
            ]
          }
        end

        it "returns an empty list" do
          users = subject.users(device_alias)
          expect(users).to eq([])
        end
      end
    end

    context "if there is a drive with the given alias" do
      let(:drive) { { alias: "disk1" } }

      include_examples "drive users", "disk1"
    end

    context "if there is a drive with a partition with the given alias" do
      let(:drive) do
        {
          partitions: [
            { alias: "p1" }
          ]
        }
      end

      include_examples "drive users", "p1"
    end

    context "if there is a MD RAID with the given alias" do
      let(:md_raid) { { alias: "md1" } }

      include_examples "md users", "md1"
    end

    context "if there is a MD RAID with a partition with the given alias" do
      let(:md_raid) do
        {
          partitions: [
            { alias: "p1" }
          ]
        }
      end

      include_examples "md users", "p1"
    end
  end

  describe "#target_users" do
    shared_examples "target users" do |device_alias|
      context "and it is used as target for physical volumes" do
        let(:volume_groups) do
          [
            {
              name:            "vg1",
              physicalVolumes: [{ generate: [device_alias] }]
            },
            { name: "vg2" },
            {
              name:            "vg3",
              physicalVolumes: [{ generate: [device_alias] }]
            }
          ]
        end

        it "returns the volume groups" do
          users = subject.target_users(device_alias)
          expect(users).to contain_exactly(subject.volume_groups[0], subject.volume_groups[2])
        end
      end

      context "and it is not used as target for physical volumes" do
        let(:volume_groups) do
          [
            { name: "vg1" }
          ]
        end

        it "returns an empty list" do
          users = subject.target_users(device_alias)
          expect(users).to eq([])
        end
      end
    end

    let(:config_json) do
      {
        drives:       drives,
        mdRaids:      md_raids,
        volumeGroups: volume_groups
      }
    end

    let(:drives) { nil }
    let(:md_raids) { nil }
    let(:volume_groups) { nil }

    context "if there is a drive with the given alias" do
      let(:drives) do
        [
          { alias: "disk1" }
        ]
      end

      include_examples "target users", "disk1"
    end

    context "if there is a MD RAID with the given alias" do
      let(:md_raids) do
        [
          { alias: "md1" }
        ]
      end

      include_examples "target users", "md1"
    end
  end
end
