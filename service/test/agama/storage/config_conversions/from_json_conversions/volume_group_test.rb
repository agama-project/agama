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
require "agama/storage/config_conversions/from_json_conversions/volume_group"
require "agama/storage/configs/encryption"
require "agama/storage/configs/logical_volume"
require "agama/storage/configs/volume_group"
require "y2storage/encryption_method"
require "y2storage/refinements"

using Y2Storage::Refinements::SizeCasts

describe Agama::Storage::ConfigConversions::FromJSONConversions::VolumeGroup do
  subject do
    described_class.new(volume_group_json)
  end

  describe "#convert" do
    let(:volume_group_json) do
      {
        name:            name,
        extentSize:      extent_size,
        physicalVolumes: physical_volumes,
        logicalVolumes:  logical_volumes
      }
    end

    let(:name) { nil }
    let(:extent_size) { nil }
    let(:physical_volumes) { nil }
    let(:logical_volumes) { nil }

    it "returns a volume group config" do
      volume_group = subject.convert
      expect(volume_group).to be_a(Agama::Storage::Configs::VolumeGroup)
    end

    context "if 'name' is not specified" do
      let(:name) { nil }

      it "does not set #name" do
        volume_group = subject.convert
        expect(volume_group.name).to be_nil
      end
    end

    context "if 'extentSize' is not specified" do
      let(:extent_size) { nil }

      it "does not set #extent_size" do
        volume_group = subject.convert
        expect(volume_group.extent_size).to be_nil
      end
    end

    context "if 'physicalVolumes' is not specified" do
      let(:physical_volumes) { nil }

      it "sets #physical_volumes to the expected vale" do
        volume_group = subject.convert
        expect(volume_group.physical_volumes).to eq([])
      end
    end

    context "if 'logicalVolumes' is not specified" do
      let(:logical_volumes) { nil }

      it "sets #logical_volumes to the expected vale" do
        volume_group = subject.convert
        expect(volume_group.logical_volumes).to eq([])
      end
    end

    context "if 'name' is specified" do
      let(:name) { "test" }

      it "sets #name to the expected value" do
        volume_group = subject.convert
        expect(volume_group.name).to eq("test")
      end
    end

    context "if 'extentSize' is specified" do
      context "if 'extentSize' is a string" do
        let(:extent_size) { "4 KiB" }

        it "sets #extent_size to the expected value" do
          volume_group = subject.convert
          expect(volume_group.extent_size).to eq(4.KiB)
        end
      end

      context "if 'extentSize' is a number" do
        let(:extent_size) { 4096 }

        it "sets #extent_size to the expected value" do
          volume_group = subject.convert
          expect(volume_group.extent_size).to eq(4.KiB)
        end
      end
    end

    context "if 'physicalVolumes' is specified" do
      context "with an empty list" do
        let(:physical_volumes) { [] }

        it "sets #physical_volumes to the expected value" do
          volume_group = subject.convert
          expect(volume_group.physical_volumes).to eq([])
        end

        it "sets #physical_volumes_devices to the expected value" do
          volume_group = subject.convert
          expect(volume_group.physical_volumes_devices).to eq([])
        end

        it "sets #physical_volumes_encryption to the expected value" do
          volume_group = subject.convert
          expect(volume_group.physical_volumes_encryption).to be_nil
        end
      end

      context "with a list of aliases" do
        let(:physical_volumes) { ["pv1", "pv2"] }

        it "sets #physical_volumes to the expected value" do
          volume_group = subject.convert
          expect(volume_group.physical_volumes).to contain_exactly("pv1", "pv2")
        end

        it "sets #physical_volumes_devices to the expected value" do
          volume_group = subject.convert
          expect(volume_group.physical_volumes_devices).to eq([])
        end

        it "sets #physical_volumes_encryption to the expected value" do
          volume_group = subject.convert
          expect(volume_group.physical_volumes_encryption).to be_nil
        end
      end

      context "with a list including a physical volume with 'generate' array" do
        let(:physical_volumes) do
          [
            "pv1",
            { generate: ["disk1", "disk2"] },
            "pv2"
          ]
        end

        it "sets #physical_volumes to the expected value" do
          volume_group = subject.convert
          expect(volume_group.physical_volumes).to contain_exactly("pv1", "pv2")
        end

        it "sets #physical_volumes_devices to the expected value" do
          volume_group = subject.convert
          expect(volume_group.physical_volumes_devices).to contain_exactly("disk1", "disk2")
        end

        it "does not set #physical_volumes_encryption" do
          volume_group = subject.convert
          expect(volume_group.physical_volumes_encryption).to be_nil
        end
      end

      context "with a list including a physical volume with 'generate' section" do
        let(:physical_volumes) do
          [
            "pv1",
            {
              generate: {
                targetDevices: target_devices,
                encryption:    encryption
              }
            },
            "pv2"
          ]
        end

        let(:target_devices) { nil }

        let(:encryption) { nil }

        it "sets #physical_volumes to the expected value" do
          volume_group = subject.convert
          expect(volume_group.physical_volumes).to contain_exactly("pv1", "pv2")
        end

        context "if the physical volume does not specify 'targetDevices'" do
          let(:target_devices) { nil }

          it "sets #physical_volumes_devices to the expected value" do
            volume_group = subject.convert
            expect(volume_group.physical_volumes_devices).to eq([])
          end
        end

        context "if the physical volume does not specify 'encryption'" do
          let(:target_devices) { nil }

          it "does not set #physical_volumes_encryption" do
            volume_group = subject.convert
            expect(volume_group.physical_volumes_encryption).to be_nil
          end
        end

        context "if the physical volume specifies 'targetDevices'" do
          let(:target_devices) { ["disk1"] }

          it "sets #physical_volumes_devices to the expected value" do
            volume_group = subject.convert
            expect(volume_group.physical_volumes_devices).to contain_exactly("disk1")
          end
        end

        context "if the physical volume specifies 'encryption'" do
          let(:encryption) do
            {
              luks1: { password: "12345" }
            }
          end

          it "sets #physical_volumes_encryption to the expected value" do
            volume_group = subject.convert
            encryption = volume_group.physical_volumes_encryption
            expect(encryption).to be_a(Agama::Storage::Configs::Encryption)
            expect(encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS1)
            expect(encryption.password).to eq("12345")
            expect(encryption.pbkd_function).to be_nil
            expect(encryption.label).to be_nil
            expect(encryption.cipher).to be_nil
            expect(encryption.key_size).to be_nil
          end
        end
      end
    end

    context "if 'logicalVolumes' is specified" do
      context "with an empty list" do
        let(:logical_volumes) { [] }

        it "sets #logical_volumes to empty" do
          volume_group = subject.convert
          expect(volume_group.logical_volumes).to eq([])
        end
      end

      context "with a list of logical volumes" do
        let(:logical_volumes) do
          [
            { name: "root" },
            { name: "test" }
          ]
        end

        it "sets #logical_volumes to the expected value" do
          volume_group = subject.convert

          lvs = volume_group.logical_volumes
          expect(lvs.size).to eq(2)

          lv1, lv2 = lvs
          expect(lv1).to be_a(Agama::Storage::Configs::LogicalVolume)
          expect(lv1.name).to eq("root")
          expect(lv2).to be_a(Agama::Storage::Configs::LogicalVolume)
          expect(lv2.name).to eq("test")
        end
      end
    end
  end
end
