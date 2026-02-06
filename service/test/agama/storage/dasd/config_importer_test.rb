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

require_relative "../../../test_helper"
require "agama/storage/dasd/config"
require "agama/storage/dasd/config_importer"
require "agama/storage/dasd/config_importers/device"

RSpec.describe Agama::Storage::DASD::ConfigImporter do
  subject { described_class.new(config_json) }

  describe "#import" do
    let(:config_json) { {} }

    it "generates a DASD config" do
      config = subject.import
      expect(config).to be_a(Agama::Storage::DASD::Config)
    end

    context "with an empty JSON" do
      let(:config_json) { {} }

      it "sets #devices to an empty array" do
        config = subject.import
        expect(config.devices).to eq([])
      end
    end

    context "with a JSON specifying 'devices' as nil" do
      let(:config_json) { { devices: nil } }

      it "sets #devices to an empty array" do
        config = subject.import
        expect(config.devices).to eq([])
      end
    end

    context "with a JSON specifying 'devices'" do
      let(:config_json) { { devices: devices_json } }

      context "with an empty list" do
        let(:devices_json) { [] }

        it "sets #devices to an empty array" do
          config = subject.import
          expect(config.devices).to eq([])
        end
      end

      context "with a list of devices" do
        let(:devices_json) { [device1_json, device2_json] }
        let(:device1_json) { { channel: "0.0.1234" } }
        let(:device2_json) { { channel: "0.0.5678" } }

        it "sets #devices to the expected value" do
          config = subject.import
          expect(config.devices.size).to eq(2)
          expect(config.devices).to all(be_a(Agama::Storage::DASD::Configs::Device))

          device1, device2 = config.devices
          expect(device1.channel).to eq("0.0.1234")
          expect(device2.channel).to eq("0.0.5678")
        end

        context "if a device does not specify 'state'" do
          let(:device1_json) { { channel: "0.0.1234" } }

          it "sets #active? to the expected value" do
            device = subject.import.devices.first
            expect(device.active?).to eq(true)
          end
        end

        context "if a device specifies 'state = active'" do
          let(:device1_json) { { channel: "0.0.1234", state: "active" } }

          it "sets #active? to the expected value" do
            device = subject.import.devices.first
            expect(device.active?).to eq(true)
          end
        end

        context "if a device specifies 'state: offline'" do
          let(:device1_json) { { channel: "0.0.1234", state: "offline" } }

          it "sets #active? to the expected value" do
            device = subject.import.devices.first
            expect(device.active?).to eq(false)
          end
        end

        context "if a device does not specify 'format'" do
          let(:device1_json) { { channel: "0.0.1234" } }

          it "sets #format_action to the expected value" do
            device = subject.import.devices.first
            expect(device.format_action)
              .to eq(Agama::Storage::DASD::Configs::Device::FormatAction::FORMAT_IF_NEEDED)
          end
        end

        context "if a device specifies 'format: true'" do
          let(:device1_json) { { channel: "0.0.1234", format: true } }

          it "sets #format_action to the expected value" do
            device = subject.import.devices.first
            expect(device.format_action)
              .to eq(Agama::Storage::DASD::Configs::Device::FormatAction::FORMAT)
          end
        end

        context "if a device specifies 'format: false'" do
          let(:device1_json) { { channel: "0.0.1234", format: false } }

          it "sets #format_action to the expected value" do
            device = subject.import.devices.first
            expect(device.format_action)
              .to eq(Agama::Storage::DASD::Configs::Device::FormatAction::NONE)
          end
        end

        context "if a device does not specify 'diag'" do
          let(:device1_json) { { channel: "0.0.1234" } }

          it "sets #diag_action to the expected value" do
            device = subject.import.devices.first
            expect(device.diag_action)
              .to eq(Agama::Storage::DASD::Configs::Device::DiagAction::NONE)
          end
        end

        context "if a device specifies 'diag: true'" do
          let(:device1_json) { { channel: "0.0.1234", diag: true } }

          it "sets #diag_action to the expected value" do
            device = subject.import.devices.first
            expect(device.diag_action)
              .to eq(Agama::Storage::DASD::Configs::Device::DiagAction::ENABLE)
          end
        end

        context "if a device specifies 'diag: false'" do
          let(:device1_json) { { channel: "0.0.1234", diag: false } }

          it "sets #diag_action to the expected value" do
            device = subject.import.devices.first
            expect(device.diag_action)
              .to eq(Agama::Storage::DASD::Configs::Device::DiagAction::DISABLE)
          end
        end
      end
    end
  end
end
