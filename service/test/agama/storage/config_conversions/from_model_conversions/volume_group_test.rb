# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require_relative "./context"
require_relative "./examples"
require "agama/storage/config_conversions/from_model_conversions/volume_group"
require "agama/storage/configs/drive"
require "agama/storage/configs/logical_volume"
require "agama/storage/configs/md_raid"
require "agama/storage/configs/search"
require "agama/storage/bootloader_config"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

describe Agama::Storage::ConfigConversions::FromModelConversions::VolumeGroup do
  include_context "from model conversions"

  let(:bootloader_config) { Agama::Storage::BootloaderConfig.new }

  subject do
    described_class.new(model_json, product_config, bootloader_config, targets)
  end

  describe "#convert" do
    let(:model_json) { {} }

    let(:targets) { [] }

    it "returns a volume group config" do
      config = subject.convert
      expect(config).to be_a(Agama::Storage::Configs::VolumeGroup)
    end

    context "if 'vgName' is not specified" do
      let(:model_json) { {} }

      it "does not set #name" do
        config = subject.convert
        expect(config.name).to be_nil
      end
    end

    context "if 'extentSize' is not specified" do
      let(:model_json) { {} }

      it "does not set #extent_size" do
        config = subject.convert
        expect(config.extent_size).to be_nil
      end
    end

    context "if 'targetDevices' is not specified" do
      let(:model_json) { {} }

      it "sets #physical_volumes_devices to the expected value" do
        config = subject.convert
        expect(config.physical_volumes_devices).to eq([])
      end
    end

    context "if 'targetDevicesPolicy' is not specified" do
      let(:model_json) { {} }

      it "sets #physical_volumes_policy to :use_available" do
        config = subject.convert
        expect(config.physical_volumes_policy).to eq(:use_available)
      end
    end

    context "if 'logicalVolumes' is not specified" do
      let(:model_json) { {} }

      it "sets #logical_volumes to the expected value" do
        config = subject.convert
        expect(config.logical_volumes).to eq([])
      end
    end

    context "if 'spacePolicy' is not specified" do
      let(:model_json) { {} }
      include_examples "without spacePolicy", :logical_volumes
    end

    context "if 'vgName' is specified" do
      let(:model_json) { { vgName: "vg1" } }

      it "sets #name to the expected value" do
        config = subject.convert
        expect(config.name).to eq("vg1")
      end
    end

    context "if 'extentSize' is specified" do
      let(:model_json) { { extentSize: 1.KiB.to_i } }

      it "sets #extent_size to the expected value" do
        config = subject.convert
        expect(config.extent_size).to eq(1.KiB)
      end
    end

    context "if 'targetDevices' is specified" do
      let(:model_json) { { targetDevices: ["/dev/vda", "/dev/md0"] } }

      let(:drive) do
        Agama::Storage::Configs::Drive.new.tap do |drive|
          drive.search = Agama::Storage::Configs::Search.new.tap { |s| s.name = "/dev/vda" }
        end
      end

      let(:md_raid) do
        Agama::Storage::Configs::MdRaid.new.tap do |md_raid|
          md_raid.search = Agama::Storage::Configs::Search.new.tap { |s| s.name = "/dev/md0" }
        end
      end

      let(:targets) { [drive, md_raid] }

      it "sets an alias to the target devices" do
        subject.convert
        expect(drive.alias).to_not be_nil
        expect(md_raid.alias).to_not be_nil
      end

      it "sets #physical_volumes_devices to the expected value" do
        config = subject.convert
        expect(config.physical_volumes_devices).to eq([drive.alias, md_raid.alias])
      end
    end

    context "if 'targetDevicesPolicy' is specified" do
      context "with 'useNeeded'" do
        let(:model_json) { { targetDevicesPolicy: "useNeeded" } }

        it "sets #physical_volumes_policy to :use_needed" do
          config = subject.convert
          expect(config.physical_volumes_policy).to eq(:use_needed)
        end
      end

      context "with 'useAvailable'" do
        let(:model_json) { { targetDevicesPolicy: "useAvailable" } }

        it "sets #physical_volumes_policy to :use_available" do
          config = subject.convert
          expect(config.physical_volumes_policy).to eq(:use_available)
        end
      end

      context "with an unknown value" do
        let(:model_json) { { targetDevicesPolicy: "unknownValue" } }

        it "sets #physical_volumes_policy to :use_available" do
          config = subject.convert
          expect(config.physical_volumes_policy).to eq(:use_available)
        end
      end
    end

    context "if 'logicalVolumes' is specified" do
      let(:model_json) { { logicalVolumes: logical_volumes } }

      context "with an empty list" do
        let(:logical_volumes) { [] }

        it "sets #logical_volumes to the expected value" do
          config = subject.convert
          expect(config.logical_volumes).to eq([])
        end
      end

      context "with a list of logical volumes" do
        let(:logical_volumes) do
          [
            { lvName: "lv1" },
            { lvName: "lv2" }
          ]
        end
        it "sets #logical_volumes to the expected value" do
          config = subject.convert
          expect(config.logical_volumes)
            .to all(be_a(Agama::Storage::Configs::LogicalVolume))
          expect(config.logical_volumes.size).to eq(2)

          lv1, lv2 = config.logical_volumes
          expect(lv1.name).to eq("lv1")
          expect(lv2.name).to eq("lv2")
        end
      end
    end

    context "if 'spacePolicy' is specified" do
      let(:model_json) { { spacePolicy: spacePolicy } }
      include_examples "with spacePolicy"
    end

    context "if 'spacePolicy' and 'logicalVolumes' are specified" do
      let(:model_json) { { spacePolicy: spacePolicy, logicalVolumes: logical_volumes } }
      include_examples "with spacePolicy and volumes"
    end
  end
end
