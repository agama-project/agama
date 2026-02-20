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

# yast2-s390 is not available for all architectures. Defining Y2S390::ZFCP constant here in order to
# make possible to mock that class independently on the architecture. Note that Y2S390 classes are
# not required at all in tests, see test_helper file.
module Y2S390
  ZFCP = Class.new
end

describe Agama::Storage::ZFCP::Manager do
  subject { described_class.new(logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:yast_zfcp) { double(Y2S390::ZFCP) }

  let(:controller_records) { [[]] }

  let(:disk_records) { [[]] }

  let(:fa00_record) { { "sysfs_bus_id" => "0.0.fa00" } }
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
    allow(yast_zfcp).to receive(:controllers).and_return(*controller_records)
    allow(yast_zfcp).to receive(:disks).and_return(*disk_records)
  end

  describe "#probed?" do
    it "returns false if zFCP is not probed yet" do
      expect(subject.probed?).to eq(false)
    end

    it "returns true if zFCP was already probed" do
      subject.probe
      expect(subject.probed?).to eq(true)
    end
  end

  describe "#probe" do
    let(:controller_records) { [[fa00_record]] }
    let(:disk_records) { [[sda_record]] }

    before do
      allow(yast_zfcp).to receive(:activated_controller?).with("0.0.fa00").and_return(true)
      allow(yast_zfcp).to receive(:lun_scan_controller?).with("0.0.fa00").and_return(false)
      allow(yast_zfcp).to receive(:find_wwpns).with("0.0.fa00")
        .and_return("stdout" => ["0x500507630708d3b3"])
      allow(yast_zfcp).to receive(:find_luns).with("0.0.fa00", "0x500507630708d3b3")
        .and_return("stdout" => ["0x0013000000000000", "0x0000000000000004"])
    end

    it "reads the controllers" do
      subject.probe
      expect(subject.controllers.size).to eq(1)
      controller = subject.controllers.first
      expect(controller.channel).to eq("0.0.fa00")
      expect(controller.active?).to eq(true)
      expect(controller.wwpns).to eq(["0x500507630708d3b3"])
    end

    it "reads devices" do
      subject.probe
      expect(subject.devices.size).to contain_exactly(
        an_object_having_attributes(lun: "0x0013000000000000"),
        an_object_having_attributes(lun: "0x0000000000000004")
      )
      # device = subject.devices.first
      # expect(device.channel).to eq("0.0.fa00")
      # expect(device.wwpn).to eq("0x500507630708d3b3")
      # expect(device.lun).to eq("0x0013000000000000")
      # expect(device).to be_active
      # expect(device.device_name).to eq("/dev/sda")
    end

    it "sets probed? to true" do
      subject.probe
      expect(subject).to be_probed
    end
  end

  describe "#configure" do
    let(:config_json) { { controllers: [], devices: [] } }
    let(:config) do
      double("Agama::Storage::ZFCP::Config", controllers: [], devices: [])
    end

    before do
      allow(Agama::Storage::ZFCP::ConfigImporter).to receive(:new).with(config_json).and_return(
        instance_double(Agama::Storage::ZFCP::ConfigImporter, import: config)
      )
    end

    it "probes if not probed yet" do
      expect(subject).to receive(:probe).and_call_original
      allow(yast_zfcp).to receive(:controllers).and_return([])
      allow(yast_zfcp).to receive(:disks).and_return([])
      subject.configure(config_json)
      expect(subject).to be_probed
    end

    context "with probed subject" do
      before do
        subject.probe
        allow(subject).to receive(:probe)
      end

      context "activating controllers" do
        let(:controller_to_activate) do
          Agama::Storage::ZFCP::Controller.new("0.0.fb00").tap do |c|
            c.active = true
          end
        end
        let(:config) do
          double("Agama::Storage::ZFCP::Config",
            controllers: [controller_to_activate], devices: [])
        end

        before do
          allow(yast_zfcp).to receive(:activate_controller).with("0.0.fb00").and_return("exit" => 0)
          allow(subject).to receive(:sleep) # avoid sleeping in tests
        end

        it "activates the controller" do
          expect(yast_zfcp).to receive(:activate_controller).with("0.0.fb00")
          subject.configure(config_json)
        end

        it "re-probes after activating" do
          expect(subject).to receive(:probe)
          subject.configure(config_json)
        end

        it "returns true for system changed" do
          expect(subject.configure(config_json)).to be true
        end

        context "when controller is already active" do
          before do
            active_controller = Agama::Storage::ZFCP::Controller.new("0.0.fb00").tap do |c|
              c.active = true
            end
            subject.instance_variable_set(:@controllers, [active_controller])
          end

          it "does not activate the controller" do
            expect(yast_zfcp).not_to receive(:activate_controller)
            expect(subject.configure(config_json)).to be false
          end
        end
      end

      context "activating devices" do
        let(:device_to_activate) do
          Agama::Storage::ZFCP::Device.new("0.0.fa00", "0x500507630708d3b3",
            "0x0013000000000000").tap do |d|
            d.active = true
          end
        end
        let(:config) do
          double("Agama::Storage::ZFCP::Config",
            controllers: [], devices: [device_to_activate])
        end

        before do
          allow(yast_zfcp).to receive(:activate_disk).and_return("exit" => 0)
        end

        it "activates the device" do
          expect(yast_zfcp).to receive(:activate_disk).with("0.0.fa00", "0x500507630708d3b3",
            "0x0013000000000000")
          subject.configure(config_json)
        end

        it "re-probes after activating" do
          expect(subject).to receive(:probe)
          subject.configure(config_json)
        end

        it "returns true for system changed" do
          expect(subject.configure(config_json)).to be true
        end

        context "when device is already active" do
          before do
            active_device = Agama::Storage::ZFCP::Device.new("0.0.fa00", "0x500507630708d3b3",
              "0x0013000000000000").tap do |d|
              d.active = true
            end
            subject.instance_variable_set(:@devices, [active_device])
          end

          it "does not activate the device" do
            expect(yast_zfcp).not_to receive(:activate_disk)
            expect(subject.configure(config_json)).to be false
          end
        end
      end

      context "deactivating devices" do
        let(:device_to_deactivate) do
          Agama::Storage::ZFCP::Device.new("0.0.fa00", "0x500507630708d3b3",
            "0x0013000000000000").tap do |d|
            d.active = false
          end
        end
        let(:config) do
          double("Agama::Storage::ZFCP::Config",
            controllers: [], devices: [device_to_deactivate])
        end

        before do
          active_device = Agama::Storage::ZFCP::Device.new("0.0.fa00", "0x500507630708d3b3",
            "0x0013000000000000").tap do |d|
            d.active = true
          end
          subject.instance_variable_set(:@devices, [active_device])
          allow(yast_zfcp).to receive(:deactivate_disk).and_return("exit" => 0)
        end

        it "deactivates the device" do
          expect(yast_zfcp).to receive(:deactivate_disk).with("0.0.fa00", "0x500507630708d3b3",
            "0x0013000000000000")
          subject.configure(config_json)
        end

        it "re-probes after deactivating" do
          expect(subject).to receive(:probe)
          subject.configure(config_json)
        end

        it "returns true for system changed" do
          expect(subject.configure(config_json)).to be true
        end

        context "when device is already inactive" do
          before do
            inactive_device = Agama::Storage::ZFCP::Device.new("0.0.fa00", "0x500507630708d3b3",
              "0x0013000000000000").tap do |d|
              d.active = false
            end
            subject.instance_variable_set(:@devices, [inactive_device])
          end

          it "does not deactivate the device" do
            expect(yast_zfcp).not_to receive(:deactivate_disk)
            expect(subject.configure(config_json)).to be false
          end
        end
      end

      context "when nothing changes" do
        it "returns false" do
          expect(subject.configure(config_json)).to be false
        end

        it "does not re-probe" do
          expect(subject).not_to receive(:probe)
          subject.configure(config_json)
        end
      end

      it "stores the config_json" do
        subject.configure(config_json)
        expect(subject.config_json).to eq(config_json)
      end
    end
  end
end
