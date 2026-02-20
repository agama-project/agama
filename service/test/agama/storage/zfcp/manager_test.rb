# frozen_string_literal: true

# Copyright (c) [2023-2026] SUSE LLC
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
require "agama/storage/zfcp/manager"
require "agama/storage/zfcp/config_importer"
require "agama/storage/zfcp/controller"
require "agama/storage/zfcp/device"
require "agama/issue"

# yast2-s390 is not available for all architectures. Defining Y2S390::ZFCP constant here in order to
# make possible to mock that class independently on the architecture. Note that Y2S390 classes are
# not required at all in tests, see test_helper file.
module Y2S390
  ZFCP = Class.new
end

describe Agama::Storage::ZFCP::Manager do
  subject { described_class.new(logger: logger) }

  let(:logger) { Logger.new($stdout, level: :fatal) }
  let(:yast_zfcp) { double(Y2S390::ZFCP) }
  let(:controller_records) { [] }
  let(:disk_records) { [] }
  let(:fa00_record) { { "sysfs_bus_id" => "0.0.fa00" } }
  let(:fc00_record) { { "sysfs_bus_id" => "0.0.fc00" } }

  let(:sda_record) do
    {
      "detail"   => {
        "controller_id" => "0.0.fa00",
        "wwpn"          => "0x500507630708d3b3",
        "fcp_lun"       => "0x0013000000000000"
      },
      "dev_name" => "/dev/sda"
    }
  end

  let(:sdb_record) do
    {
      "detail"   => {
        "controller_id" => "0.0.fa00",
        "wwpn"          => "0x500507630703d3b3",
        "fcp_lun"       => "0x0000000000000004"
      },
      "dev_name" => "/dev/sdb"
    }
  end

  before do
    allow(Y2S390::ZFCP).to receive(:new).and_return(yast_zfcp)
    allow(yast_zfcp).to receive(:probe_controllers)
    allow(yast_zfcp).to receive(:probe_disks)
    allow(yast_zfcp).to receive(:controllers).and_return(controller_records)
    allow(yast_zfcp).to receive(:disks).and_return(disk_records)
    allow(yast_zfcp).to receive(:lun_scan_controller?).and_return(false)
    allow(yast_zfcp).to receive(:activated_controller?).and_return(false)
    allow(yast_zfcp).to receive(:activate_controller).and_return({ "exit" => 0 })
    allow(yast_zfcp).to receive(:activate_disk).and_return({ "exit" => 0 })
    allow(yast_zfcp).to receive(:find_wwpns).and_return({ "stdout" => [] })
    allow(yast_zfcp).to receive(:find_luns).and_return({ "stdout" => [] })

  end

  describe "#probed?" do
    it "is false initially" do
      expect(subject).not_to be_probed
    end

    it "is true after probing" do
      subject.probe
      expect(subject).to be_probed
    end
  end

  describe "#probe" do
    let(:controller_records) { [fa00_record, fc00_record] }

    before do
      allow(yast_zfcp).to receive(:activated_controller?).with("0.0.fa00").and_return(false)
      allow(yast_zfcp).to receive(:activated_controller?).with("0.0.fc00").and_return(false)
      allow(yast_zfcp).to receive(:lun_scan_controller?).with("0.0.fa00").and_return(true)
      allow(yast_zfcp).to receive(:lun_scan_controller?).with("0.0.fc00").and_return(false)
    end

    it "probes controllers" do
      subject.probe
      expect(subject.controllers).to contain_exactly(
        an_object_having_attributes(
          channel: "0.0.fa00",
          active?: false,
          lun_scan?: true,
          wwpns: []
        ),
        an_object_having_attributes(
          channel: "0.0.fc00",
          active?: false,
          lun_scan?: false,
          wwpns: []
        )
      )
    end

    context "with an active controller" do
      before do
        allow(yast_zfcp).to receive(:activated_controller?).with("0.0.fa00").and_return(true)

        allow(yast_zfcp).to receive(:find_wwpns)
          .with("0.0.fa00")
          .and_return("stdout" => ["0x500507630708d3b3"])

        allow(yast_zfcp).to receive(:find_luns)
          .with("0.0.fa00", "0x500507630708d3b3")
          .and_return("stdout" => ["0x0013000000000000", "0x0000000000000004"])
      end

      let(:disk_records) { [sda_record] }

      it "probes WWPNs and LUNs" do
        subject.probe

        expect(subject.controllers).to contain_exactly(
          an_object_having_attributes(
            channel: "0.0.fa00",
            active?: true,
            wwpns: ["0x500507630708d3b3"]
          ),
          an_object_having_attributes(
            channel: "0.0.fc00",
            active?: false,
            wwpns: []
          )
        )

        expect(subject.devices).to contain_exactly(
          an_object_having_attributes(
            channel: "0.0.fa00",
            wwpn: "0x500507630708d3b3",
            lun: "0x0013000000000000",
            active?: true,
            device_name: "/dev/sda"
          ),
          an_object_having_attributes(
            channel: "0.0.fa00",
            wwpn: "0x500507630708d3b3",
            lun: "0x0000000000000004",
            active?: false,
            device_name: nil
          )
        )
      end
    end
  end

  describe "#configure" do
    let(:controller_records) { [fa00_record] }

    before do
      allow(subject).to receive(:sleep)
    end

    context "when the config activates a controller" do
      let(:config_json) { { controllers: ["0.0.fa00"] } }

      context "on success" do
        before do
          allow(yast_zfcp).to receive(:activate_controller).with("0.0.fa00").and_return("exit" => 0)
        end

        it "activates the controller" do
          expect(yast_zfcp).to receive(:activate_controller).with("0.0.fa00")
          subject.configure(config_json)
        end

        it "does not generate an issue" do
          subject.configure(config_json)
          expect(subject.issues).to eq([])
        end

        it "returns true" do
          expect(subject.configure(config_json)).to eq(true)
        end
      end

      context "on failure" do
        before do
          allow(yast_zfcp).to receive(:activate_controller).with("0.0.fa00").and_return("exit" => 1)
        end

        it "generates an issue" do
          subject.configure(config_json)
          expect(subject.issues).to include(
            an_object_having_attributes(
              description: /0.0.fa00 cannot be activated/
            )
          )
        end

        it "returns false" do
          expect(subject.configure(config_json)).to eq(false)
        end
      end

      context "if the controller is already active" do
        before do
          allow(yast_zfcp).to receive(:activated_controller?).with("0.0.fa00").and_return(true)
        end

        it "does not activate the controller" do
          expect(yast_zfcp).to_not receive(:activate_controller).with("0.0.fa00")
          subject.configure(config_json)
        end

        it "does not generate an issue" do
          subject.configure(config_json)
          expect(subject.issues).to eq([])
        end

        it "returns false" do
          expect(subject.configure(config_json)).to eq(false)
        end
      end
    end

    context "activating a device" do
      let(:config_json) do
        {
          devices: [
            {
              channel: "0.0.fa00",
              wwpn: "0x500507630708d3b3",
              lun: "0x0013000000000000"
            }
          ]
        }
      end

      before do
        allow(yast_zfcp).to receive(:find_wwpns)
          .with("0.0.fa00")
          .and_return("stdout" => ["0x500507630708d3b3"])

        allow(yast_zfcp).to receive(:find_luns)
          .with("0.0.fa00", "0x500507630708d3b3")
          .and_return("stdout" => ["0x0013000000000000"])
      end

      context "if the controller is not active yet" do
        before do
          allow(yast_zfcp).to receive(:activated_controller?).with("0.0.fa00").and_return(false)
        end

        it "activates the controller" do
          expect(yast_zfcp).to receive(:activate_controller)
            .with("0.0.fa00").and_return({ "exit" => 0 })

          subject.configure(config_json)
        end
      end

      context "if the controller is already active" do
        before do
          allow(yast_zfcp).to receive(:activated_controller?).with("0.0.fa00").and_return(true)
        end

        it "does not activate the controller" do
          expect(yast_zfcp).to_not receive(:activate_controller).with("0.0.fa00")
          subject.configure(config_json)
        end
      end

      context "on success" do
        before do
          allow(yast_zfcp).to receive(:activate_disk)
            .with("0.0.fa00", "0x500507630708d3b3", "0x0013000000000000")
            .and_return("exit" => 0)

          allow(yast_zfcp).to receive(:activated_controller?).with("0.0.fa00").and_return(true)
        end

        it "activates the device" do
          expect(yast_zfcp).to receive(:activate_disk)
            .with("0.0.fa00", "0x500507630708d3b3", "0x0013000000000000")
            .and_return("exit" => 0)

          subject.configure(config_json)
        end

        it "does not generate an issue" do
          subject.configure(config_json)
          expect(subject.issues).to eq([])
        end

        it "returns true" do
          expect(subject.configure(config_json)).to eq(true)
        end
      end

      context "on failure" do
        before do
          allow(yast_zfcp).to receive(:activate_disk)
            .with("0.0.fa00", "0x500507630708d3b3", "0x0013000000000000")
            .and_return("exit" => 1)
        end

        it "generates an issue" do
          subject.configure(config_json)
          expect(subject.issues).to include(
            an_object_having_attributes(
              description: /0x0013000000000000 cannot be activated/
            )
          )
        end

        it "returns false" do
          expect(subject.configure(config_json)).to eq(false)
        end
      end

      context "if the device is already active" do
        let(:disk_records) { [sda_record] }

        it "does not activate the controller" do
          expect(yast_zfcp).to_not receive(:activate_controller).with("0.0.fa00")
          subject.configure(config_json)
        end

        it "does not generate an issue" do
          subject.configure(config_json)
          expect(subject.issues).to eq([])
        end

        it "returns false" do
          expect(subject.configure(config_json)).to eq(false)
        end
      end
    end



    context "with probed system" do
      let(:probed_controller) { Agama::Storage::ZFCP::Controller.new("0.0.fa00") }
      let(:probed_device) { Agama::Storage::ZFCP::Device.new("0.0.fa00", "wwpn1", "lun1") }

      before do
        subject.instance_variable_set(:@probed, true)
        subject.instance_variable_set(:@controllers, [probed_controller])
        subject.instance_variable_set(:@devices, [probed_device])
        allow(subject).to receive(:probe)
        allow(subject).to receive(:probe_devices)
        allow(subject).to receive(:sleep)
      end



      context "deactivating a device" do
        let(:config_device) { double("dconf", active?: false, channel: "0.0.fa00", wwpn: "wwpn1", lun: "lun1") }
        let(:config) do
          double("Agama::Storage::ZFCP::Config", channels: [], controllers: [], devices: [config_device])
        end

        before { probed_device.active = true }

        context "on success" do
          before { allow(yast_zfcp).to receive(:deactivate_disk).and_return("exit" => 0) }

          it "deactivates, reprobes devices and returns true" do
            expect(yast_zfcp).to receive(:deactivate_disk)
            expect(subject).to receive(:probe_devices)
            expect(subject.configure(config_json)).to be true
          end
        end

        context "when controller has LUN scan" do
          before { probed_controller.lun_scan = true }

          it "does not deactivate and returns false" do
            expect(yast_zfcp).not_to receive(:deactivate_disk)
            expect(subject.configure(config_json)).to be false
          end
        end
      end

      context "generating issues for missing elements" do
        let(:missing_controller) { "0.0.ffff" }
        let(:missing_device) { double("dev", active?: false, channel: "0.0.ffff", wwpn: "wwpn", lun: "lun", to_s: "a") }
        let(:config) do
          double("Agama::Storage::ZFCP::Config", channels: [], controllers: [missing_controller], devices: [missing_device])
        end

        it "adds issues for missing controllers and devices" do
          subject.configure(config_json)
          expect(subject.issues).to contain_exactly(
            an_object_having_attributes(kind: :missing_zfcp_controller),
            an_object_having_attributes(kind: :missing_zfcp_lun)
          )
        end
      end
    end
  end
end