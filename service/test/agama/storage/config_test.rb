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
          boot:   {
            configure: true,
            device:    device_alias
          },
          drives: [
            {
              alias:      "disk1",
              partitions: [
                { alias: "part1" }
              ]
            }
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
        context "and there is not a drive config with the boot device alias" do
          let(:device_alias) { "part1" }

          it "returns nil" do
            expect(subject.boot_device).to be_nil
          end
        end

        context "and there is a drive config with the boot device alias" do
          let(:device_alias) { "disk1" }

          it "returns the drive config" do
            expect(subject.boot_device).to be_a(Agama::Storage::Configs::Drive)
            expect(subject.boot_device.alias).to eq("disk1")
          end
        end
      end
    end
  end

  describe "#root_device" do
    let(:config_json) do
      {
        drives:       [
          { alias: "disk1" },
          drive
        ],
        volumeGroups: [
          { name: "vg1" },
          volume_group
        ]
      }
    end

    let(:root_volume_group) do
      {
        name:           "vg2",
        logicalVolumes: [
          {
            filesystem: { path: "/" }
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

      let(:volume_group) { root_volume_group }

      it "returns the drive" do
        expect(subject.root_device).to be_a(Agama::Storage::Configs::Drive)
        expect(subject.root_device.alias).to eq("disk2")
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

      let(:volume_group) { root_volume_group }

      it "returns the drive" do
        expect(subject.root_device).to be_a(Agama::Storage::Configs::Drive)
        expect(subject.root_device.alias).to eq("disk2")
      end
    end

    context "if there is neither root drive nor root partition" do
      let(:drive) { {} }

      context "and there is not a volume group containing a logical volume used for root" do
        let(:volume_group) { {} }

        it "returns nil" do
          expect(subject.root_device).to be_nil
        end
      end

      context "and there is a volume group containing a logical volume used for root" do
        let(:volume_group) { root_volume_group }

        it "returns the volume group" do
          expect(subject.root_device).to be_a(Agama::Storage::Configs::VolumeGroup)
          expect(subject.root_device.name).to eq("vg2")
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
              { alias: "disk1" }
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

  describe "#with_encryption" do
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
      configs = subject.with_encryption
      expect(configs.size).to eq(7)
    end

    it "includes all drives" do
      expect(subject.with_encryption).to include(*subject.drives)
    end

    it "includes all MD RAIDs" do
      expect(subject.with_encryption).to include(*subject.md_raids)
    end

    it "includes all partitions" do
      expect(subject.with_encryption).to include(*subject.partitions)
    end

    it "includes all logical volumes" do
      expect(subject.with_encryption).to include(*subject.logical_volumes)
    end

    it "does not include volume groups" do
      expect(subject.with_encryption).to_not include(*subject.volume_groups)
    end
  end

  describe "#with_filesystem" do
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
      configs = subject.with_filesystem
      expect(configs.size).to eq(7)
    end

    it "includes all drives" do
      expect(subject.with_filesystem).to include(*subject.drives)
    end

    it "includes all MD RAIDs" do
      expect(subject.with_filesystem).to include(*subject.md_raids)
    end

    it "includes all partitions" do
      expect(subject.with_filesystem).to include(*subject.partitions)
    end

    it "includes all logical volumes" do
      expect(subject.with_filesystem).to include(*subject.logical_volumes)
    end

    it "does not include volume groups" do
      expect(subject.with_filesystem).to_not include(*subject.volume_groups)
    end
  end

  describe "#with_size" do
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
      configs = subject.with_size
      expect(configs.size).to eq(3)
    end

    it "includes all partitions" do
      expect(subject.with_size).to include(*subject.partitions)
    end

    it "includes all logical volumes" do
      expect(subject.with_size).to include(*subject.logical_volumes)
    end

    it "does not include drives" do
      expect(subject.with_size).to_not include(*subject.drives)
    end

    it "does not include MD RAIDs" do
      expect(subject.with_size).to_not include(*subject.md_raids)
    end

    it "does not include volume groups" do
      expect(subject.with_size).to_not include(*subject.volume_groups)
    end
  end
end
