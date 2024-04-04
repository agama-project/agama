# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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

require_relative "../../../../../test_helper"
require "y2storage/disk_size"

shared_examples "Drive interface" do
  describe "Drive D-Bus interface" do
    let(:scenario) { "partitioned_md.yml" }

    let(:device) { devicegraph.find_by_name("/dev/sda") }

    describe "#drive_type" do
      before do
        allow(device).to receive(:is?).and_call_original
      end

      context "when the device is a disk" do
        before do
          allow(device).to receive(:is?).with(:disk).and_return(true)
        end

        it "returns 'disk'" do
          expect(subject.drive_type).to eq("disk")
        end
      end

      context "when the device is a DM RAID" do
        before do
          allow(device).to receive(:is?).with(:disk).and_return(false)
          allow(device).to receive(:is?).with(:dm_raid).and_return(true)
        end

        it "returns 'raid'" do
          expect(subject.drive_type).to eq("raid")
        end
      end

      context "when the device is a Multipath" do
        before do
          allow(device).to receive(:is?).with(:disk).and_return(false)
          allow(device).to receive(:is?).with(:dm_raid).and_return(false)
          allow(device).to receive(:is?).with(:multipath).and_return(true)
        end

        it "returns 'multipath'" do
          expect(subject.drive_type).to eq("multipath")
        end
      end

      context "when the device is a DASD" do
        before do
          allow(device).to receive(:is?).with(:disk).and_return(false)
          allow(device).to receive(:is?).with(:dm_raid).and_return(false)
          allow(device).to receive(:is?).with(:multipath).and_return(false)
          allow(device).to receive(:is?).with(:dasd).and_return(true)
        end

        it "returns 'dasd'" do
          expect(subject.drive_type).to eq("dasd")
        end
      end

      context "when the device is other type" do
        before do
          allow(device).to receive(:is?).with(:disk).and_return(false)
          allow(device).to receive(:is?).with(:dm_raid).and_return(false)
          allow(device).to receive(:is?).with(:multipath).and_return(false)
          allow(device).to receive(:is?).with(:dasd).and_return(false)
        end

        it "returns empty" do
          expect(subject.drive_type).to eq("")
        end
      end
    end

    describe "#drive_vendor" do
      before do
        allow(device).to receive(:vendor).and_return(vendor)
      end

      let(:vendor) { "Micron" }

      it "returns the vendor name" do
        expect(subject.drive_vendor).to eq(vendor)
      end

      context "if vendor is unknown" do
        let(:vendor) { nil }

        it "returns an empty string" do
          expect(subject.drive_vendor).to eq("")
        end
      end
    end

    describe "#drive_model" do
      before do
        allow(device).to receive(:model).and_return(model)
      end

      let(:model) { "Micron 1100 SATA" }

      it "returns the model" do
        expect(subject.drive_model).to eq(model)
      end

      context "if model is unknown" do
        let(:model) { nil }

        it "returns an empty string" do
          expect(subject.drive_model).to eq("")
        end
      end
    end

    describe "#drive_bus" do
      before do
        allow(device).to receive(:bus).and_return(bus)
      end

      let(:bus) { "IDE" }

      it "returns the bus" do
        expect(subject.drive_bus).to eq(bus)
      end

      context "if bus is unknown" do
        let(:bus) { nil }

        it "returns an empty string" do
          expect(subject.drive_bus).to eq("")
        end
      end
    end

    describe "#drive_bus_id" do
      context "if the device is a DASD" do
        let(:scenario) { "dasd.xml" }

        let(:device) { devicegraph.find_by_name("/dev/dasda") }

        it "returns the bus id" do
          expect(subject.drive_bus_id).to eq("0.0.0150")
        end
      end

      context "if the device is not a DASD" do
        let(:scenario) { "partitioned_md.yml" }

        let(:device) { devicegraph.find_by_name("/dev/sda") }

        it "returns an empty string" do
          expect(subject.drive_bus_id).to eq("")
        end
      end
    end

    describe "#drive_driver" do
      before do
        allow(device).to receive(:driver).and_return(driver)
      end

      let(:driver) { ["ahci", "mmcblk"] }

      it "returns the driver names" do
        expect(subject.drive_driver).to contain_exactly(*driver)
      end
    end

    describe "#drive_transport" do
      before do
        allow(device).to receive(:transport).and_return(transport)
      end

      let(:transport) { Y2Storage::DataTransport::FCOE }

      it "returns the transport" do
        expect(subject.drive_transport).to eq("fcoe")
      end

      context "if transport is Unknown" do
        let(:transport) { Y2Storage::DataTransport::UNKNOWN }

        it "returns an empty string" do
          expect(subject.drive_transport).to eq("")
        end
      end

      context "if transport is USB" do
        let(:transport) { Y2Storage::DataTransport::USB }

        it "returns the corresponding string" do
          expect(subject.drive_transport).to eq("USB")
        end
      end

      context "if transport is missing" do
        let(:transport) { nil }

        it "returns an empty string" do
          expect(subject.drive_transport).to eq("")
        end
      end
    end

    describe "#drive_info" do
      before do
        allow(device).to receive(:sd_card?).and_return(true)
        allow(device).to receive(:boss?).and_return(false)
      end

      it "returns a hash with SDCard and DellBOSS info" do
        expect(subject.drive_info).to eq({
          "SDCard"   => true,
          "DellBOSS" => false
        })
      end
    end
  end
end
