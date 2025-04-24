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

require_relative "../../../../test_helper"
require "agama/storage/config_conversions/from_json_conversions/config"
require "agama/storage/config"
require "agama/storage/configs/boot"
require "agama/storage/configs/boot_device"
require "agama/storage/configs/drive"
require "agama/storage/configs/md_raid"
require "agama/storage/configs/volume_group"

describe Agama::Storage::ConfigConversions::FromJSONConversions::Config do
  subject do
    described_class.new(config_json)
  end

  describe "#convert" do
    let(:config_json) do
      {
        boot:         boot,
        drives:       drives,
        volumeGroups: volume_groups,
        mdRaids:      md_raids
      }
    end

    let(:boot) { nil }
    let(:drives) { nil }
    let(:volume_groups) { nil }
    let(:md_raids) { nil }

    it "returns a storage config" do
      config = subject.convert
      expect(config).to be_a(Agama::Storage::Config)
    end

    context "if 'boot' is not specified" do
      let(:boot) { nil }

      it "sets #boot to the expected value" do
        config = subject.convert
        expect(config.boot).to be_a(Agama::Storage::Configs::Boot)
        expect(config.boot.configure).to eq(true)
        expect(config.boot.device).to be_a(Agama::Storage::Configs::BootDevice)
        expect(config.boot.device.default).to eq(true)
        expect(config.boot.device.device_alias).to be_nil
      end
    end

    context "if 'drives' is not specified" do
      let(:drives) { nil }

      it "sets #drives to the expected value" do
        config = subject.convert
        expect(config.drives).to be_empty
      end
    end

    context "if 'volumeGroups' is not specified" do
      let(:volume_groups) { nil }

      it "sets #volume_groups to the expected value" do
        config = subject.convert
        expect(config.drives).to be_empty
        expect(config.volume_groups).to be_empty
      end
    end

    context "if 'boot' is specified" do
      let(:boot) do
        {
          configure: true,
          device:    device
        }
      end

      let(:device) { "sdb" }

      it "sets #boot to the expected value" do
        config = subject.convert
        expect(config.boot).to be_a(Agama::Storage::Configs::Boot)
        expect(config.boot.configure).to eq(true)
        expect(config.boot.device).to be_a(Agama::Storage::Configs::BootDevice)
        expect(config.boot.device.default).to eq(false)
        expect(config.boot.device.device_alias).to eq("sdb")
      end

      context "if boot does not specify 'device'" do
        let(:device) { nil }

        it "sets #boot to the expected value" do
          config = subject.convert
          expect(config.boot).to be_a(Agama::Storage::Configs::Boot)
          expect(config.boot.configure).to eq(true)
          expect(config.boot.device).to be_a(Agama::Storage::Configs::BootDevice)
          expect(config.boot.device.default).to eq(true)
          expect(config.boot.device.device_alias).to be_nil
        end
      end
    end

    context "if 'drives' is specified" do
      context "with an empty list" do
        let(:drives) { [] }

        it "sets #drives to the expected value" do
          config = subject.convert
          expect(config.drives).to eq([])
        end
      end

      context "with a list of drives" do
        let(:drives) do
          [
            { alias: "first-disk" },
            { alias: "second-disk" }
          ]
        end

        it "sets #drives to the expected value" do
          config = subject.convert
          expect(config.drives.size).to eq(2)
          expect(config.drives).to all(be_a(Agama::Storage::Configs::Drive))

          drive1, drive2 = config.drives
          expect(drive1.alias).to eq("first-disk")
          expect(drive1.partitions).to eq([])
          expect(drive2.alias).to eq("second-disk")
          expect(drive2.partitions).to eq([])
        end
      end
    end

    context "if 'volumeGroups' is specified" do
      context "with an empty list" do
        let(:volume_groups) { [] }

        it "sets #volume_groups to the expected value" do
          config = subject.convert
          expect(config.volume_groups).to eq([])
        end
      end

      context "with a list of volume groups" do
        let(:volume_groups) do
          [
            { name: "vg1" },
            { name: "vg2" }
          ]
        end

        it "sets #volume_groups to the expected value" do
          config = subject.convert
          expect(config.volume_groups.size).to eq(2)
          expect(config.volume_groups).to all(be_a(Agama::Storage::Configs::VolumeGroup))

          volume_group1, volume_group2 = config.volume_groups
          expect(volume_group1.name).to eq("vg1")
          expect(volume_group1.logical_volumes).to eq([])
          expect(volume_group2.name).to eq("vg2")
          expect(volume_group2.logical_volumes).to eq([])
        end
      end
    end

    context "if 'mdRaids' is specified" do
      context "with an empty list" do
        let(:md_raids) { [] }

        it "sets #md_raids to the expected value" do
          config = subject.convert
          expect(config.md_raids).to eq([])
        end
      end

      context "with a list of MD RAIDs" do
        let(:md_raids) do
          [
            { name: "system" },
            { name: "home" }
          ]
        end

        it "sets #md_raids to the expected value" do
          config = subject.convert
          expect(config.md_raids.size).to eq(2)
          expect(config.md_raids).to all(be_a(Agama::Storage::Configs::MdRaid))

          md1, md2 = config.md_raids
          expect(md1.name).to eq("system")
          expect(md1.partitions).to eq([])
          expect(md2.name).to eq("home")
          expect(md2.partitions).to eq([])
        end
      end
    end
  end
end
