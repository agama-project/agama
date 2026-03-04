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
require "agama/storage/zfcp/config"
require "agama/storage/zfcp/config_importer"

RSpec.describe Agama::Storage::ZFCP::ConfigImporter do
  subject { described_class.new(config_json) }

  describe "#import" do
    let(:config_json) { {} }

    it "generates a ZFCP config" do
      config = subject.import
      expect(config).to be_a(Agama::Storage::ZFCP::Config)
    end

    context "with an empty JSON" do
      let(:config_json) { {} }

      it "sets #controllers to an empty array" do
        config = subject.import
        expect(config.controllers).to eq([])
      end

      it "sets #devices as an empty array" do
        config = subject.import
        expect(config.devices).to eq([])
      end
    end

    context "with a JSON specifying 'controllers' as nil" do
      let(:config_json) { { controllers: nil } }

      it "sets #controllers to an empty array" do
        config = subject.import
        expect(config.controllers).to eq([])
      end
    end

    context "with a JSON specifying 'controllers'" do
      let(:config_json) { { controllers: ["0.0.fa00"] } }

      it "sets #controllers to the expected value" do
        config = subject.import
        expect(config.controllers).to eq(["0.0.fa00"])
      end
    end

    context "with a JSON specifying 'devices' as nil" do
      let(:config_json) { { devices: nil } }

      it "sets #devices as an empty array" do
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

        let(:device1_json) do
          {
            channel: "0.0.fa00",
            wwpn:    "0x500507630303c5f9",
            lun:     "0x5022000000000000"
          }
        end

        let(:device2_json) do
          {
            channel: "0.0.fb00",
            wwpn:    "0x500507630303c5f0",
            lun:     "0x5022000000000001",
            active:  false
          }
        end

        it "sets #devices to the expected value" do
          config = subject.import

          expect(config.devices).to contain_exactly(
            an_object_having_attributes(
              channel: "0.0.fa00",
              wwpn:    "0x500507630303c5f9",
              lun:     "0x5022000000000000",
              active?: true
            ),
            an_object_having_attributes(
              channel: "0.0.fb00",
              wwpn:    "0x500507630303c5f0",
              lun:     "0x5022000000000001",
              active?: false
            )
          )
        end
      end
    end
  end
end
