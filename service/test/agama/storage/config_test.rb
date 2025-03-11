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
end
