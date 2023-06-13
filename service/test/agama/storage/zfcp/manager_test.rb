# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
require "agama/storage/zfcp/controller"
require "agama/storage/zfcp/disk"

# yast2-s390 is not available for all architectures. Defining Y2S390::ZFCP constant here in order to
# make possible to mock that class independently on the architecture. Note that Y2S390 classes are
# not required at all in tests, see test_helper file.
module Y2S390
  ZFCP = Class.new
end

describe Agama::Storage::ZFCP::Manager do
  subject { described_class.new(logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  before do
    allow(Y2S390::ZFCP).to receive(:new).and_return(yast_zfcp)
    allow(yast_zfcp).to receive(:probe_controllers)
    allow(yast_zfcp).to receive(:probe_disks)
    allow(yast_zfcp).to receive(:controllers).and_return(*controller_records)
    allow(yast_zfcp).to receive(:disks).and_return(*disk_records)
  end

  let(:yast_zfcp) { double(Y2S390::ZFCP) }

  let(:controller_records) { [[]] }

  let(:disk_records) { [[]] }

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

  describe "#probe" do
    it "reads the current activated controllers and LUNS" do
      expect(yast_zfcp).to receive(:probe_controllers)
      expect(yast_zfcp).to receive(:probe_disks)

      subject.probe
    end

    let(:callback) { proc { |_, _| } }

    it "runs the on_probe callbacks" do
      subject.on_probe(&callback)

      expect(callback).to receive(:call).with([], [])

      subject.probe
    end
  end

  describe "#controllers" do
    let(:controller_records) { [[controller_record1, controller_record2]] }

    let(:controller_record1) do
      {
        "sysfs_bus_id" => "0.0.fa00"
      }
    end

    let(:controller_record2) do
      {
        "sysfs_bus_id" => "0.0.fc00"
      }
    end

    before do
      allow(yast_zfcp).to receive(:activated_controller?).with("0.0.fa00").and_return(true)
      allow(yast_zfcp).to receive(:activated_controller?).with("0.0.fc00").and_return(false)
    end

    it "returns the zFCP controllers" do
      controllers = subject.controllers

      expect(controllers).to all(be_a(Agama::Storage::ZFCP::Controller))

      controller = controllers.find { |c| c.channel == "0.0.fa00" }
      expect(controller.active?).to eq(true)

      controller = controllers.find { |c| c.channel == "0.0.fc00" }
      expect(controller.active?).to eq(false)
    end
  end

  describe "#disks" do
    let(:disk_records) { [[sda_record, sdb_record]] }

    it "returns the currently activated zFCP disks" do
      disks = subject.disks

      expect(disks).to all(be_a(Agama::Storage::ZFCP::Disk))

      expect(disks).to contain_exactly(
        an_object_having_attributes(
          name:    "/dev/sda",
          channel: "0.0.fa00",
          wwpn:    "0x500507630708d3b3",
          lun:     "0x0013000000000000"
        ),
        an_object_having_attributes(
          name:    "/dev/sdb",
          channel: "0.0.fa00",
          wwpn:    "0x500507630703d3b3",
          lun:     "0x0000000000000004"
        )
      )
    end
  end

  describe "#activate_controller" do
    before do
      allow(yast_zfcp).to receive(:activate_controller).and_return(output)

      subject.on_disks_change(&callback)
    end

    let(:output) { { "exit" => 3 } }

    let(:callback) { proc { |_| } }

    it "tries to activate the controller with the given channel id" do
      expect(yast_zfcp).to receive(:activate_controller).with("0.0.fa00")

      subject.activate_controller("0.0.fa00")
    end

    it "returns the exit code" do
      result = subject.activate_controller("0.0.fa00")

      expect(result).to eq(3)
    end

    context "if the controller was correctly activated" do
      let(:output) { { "exit" => 0 } }

      it "probes again" do
        expect(subject).to receive(:probe)

        subject.activate_controller("0.0.fa00")
      end

      context "and the zFCP disks have changed" do
        let(:disk_records) { [[sda_record], [sdb_record]] }

        it "runs the on_disks_change callbacks" do
          expect(callback).to receive(:call)

          subject.activate_controller("0.0.fa00")
        end
      end

      context "and the zFCP disks have not changed" do
        let(:disk_records) { [[sda_record], [sda_record]] }

        it "does not run the on_disks_change callbacks" do
          expect(callback).to_not receive(:call)

          subject.activate_controller("0.0.fa00")
        end
      end
    end

    context "if the controller was not activated" do
      let(:output) { { "exit" => 1 } }

      it "does not probe again" do
        expect(subject).to_not receive(:probe)

        subject.activate_controller("0.0.fa00")
      end

      it "does not run the on_disks_change callbacks" do
        expect(callback).to_not receive(:call)

        subject.activate_controller("0.0.fa00")
      end
    end
  end

  describe "#activate_disk" do
    before do
      allow(yast_zfcp).to receive(:activate_disk).and_return(output)

      subject.on_disks_change(&callback)
    end

    let(:output) { { "exit" => 3 } }

    let(:callback) { proc { |_| } }

    it "tries to activate the zFCP diks with the given channel id, WWPN and LUN" do
      expect(yast_zfcp)
        .to receive(:activate_disk).with("0.0.fa00", "0x500507630708d3b3", "0x0013000000000000")

      subject.activate_disk("0.0.fa00", "0x500507630708d3b3", "0x0013000000000000")
    end

    it "returns the exit code" do
      result = subject.activate_disk("0.0.fa00", "0x500507630708d3b3", "0x0013000000000000")

      expect(result).to eq(3)
    end

    context "if the zFCP disk was correctly activated" do
      let(:output) { { "exit" => 0 } }

      it "probes again" do
        expect(subject).to receive(:probe)

        subject.activate_disk("0.0.fa00", "0x500507630708d3b3", "0x0013000000000000")
      end

      context "and the zFCP disks have changed" do
        let(:disk_records) { [[sda_record], [sdb_record]] }

        it "runs the on_disks_change callbacks" do
          expect(callback).to receive(:call)

          subject.activate_disk("0.0.fa00", "0x500507630708d3b3", "0x0013000000000000")
        end
      end

      context "and the zFCP disks have not changed" do
        let(:disk_records) { [[sda_record], [sda_record]] }

        it "does not run the on_disks_change callbacks" do
          expect(callback).to_not receive(:call)

          subject.activate_disk("0.0.fa00", "0x500507630708d3b3", "0x0013000000000000")
        end
      end
    end

    context "if the zFCP disk was not activated" do
      let(:output) { { "exit" => 1 } }

      it "does not probe again" do
        expect(subject).to_not receive(:probe)

        subject.activate_disk("0.0.fa00", "0x500507630708d3b3", "0x0013000000000000")
      end

      it "does not run the on_disks_change callbacks" do
        expect(callback).to_not receive(:call)

        subject.activate_disk("0.0.fa00", "0x500507630708d3b3", "0x0013000000000000")
      end
    end
  end

  describe "#deactivate_disk" do
    before do
      allow(yast_zfcp).to receive(:deactivate_disk).and_return(output)

      subject.on_disks_change(&callback)
    end

    let(:output) { { "exit" => 3 } }

    let(:callback) { proc { |_| } }

    it "tries to deactivate the zFCP diks with the given channel id, WWPN and LUN" do
      expect(yast_zfcp)
        .to receive(:deactivate_disk).with("0.0.fa00", "0x500507630708d3b3", "0x0013000000000000")

      subject.deactivate_disk("0.0.fa00", "0x500507630708d3b3", "0x0013000000000000")
    end

    it "returns the exit code" do
      result = subject.deactivate_disk("0.0.fa00", "0x500507630708d3b3", "0x0013000000000000")

      expect(result).to eq(3)
    end

    context "if the zFCP disk was correctly deactivated" do
      let(:output) { { "exit" => 0 } }

      it "probes again" do
        expect(subject).to receive(:probe)

        subject.deactivate_disk("0.0.fa00", "0x500507630708d3b3", "0x0013000000000000")
      end

      context "and the zFCP disks have changed" do
        let(:disk_records) { [[sda_record], [sdb_record]] }

        it "runs the on_disks_change callbacks" do
          expect(callback).to receive(:call)

          subject.deactivate_disk("0.0.fa00", "0x500507630708d3b3", "0x0013000000000000")
        end
      end

      context "and the zFCP disks have not changed" do
        let(:disk_records) { [[sda_record], [sda_record]] }

        it "does not run the on_disks_change callbacks" do
          expect(callback).to_not receive(:call)

          subject.deactivate_disk("0.0.fa00", "0x500507630708d3b3", "0x0013000000000000")
        end
      end
    end

    context "if the zFCP disk was not deactivated" do
      let(:output) { { "exit" => 1 } }

      it "does not probe again" do
        expect(subject).to_not receive(:probe)

        subject.deactivate_disk("0.0.fa00", "0x500507630708d3b3", "0x0013000000000000")
      end

      it "does not run the on_disks_change callbacks" do
        expect(callback).to_not receive(:call)

        subject.deactivate_disk("0.0.fa00", "0x500507630708d3b3", "0x0013000000000000")
      end
    end
  end

  describe "#find_wwpns" do
    before do
      allow(yast_zfcp).to receive(:find_wwpns).with("0.0.fa00").and_return(output)
    end

    let(:output) { { "stdout" => wwpns } }

    let(:wwpns) { ["0x500507630703d3b3", "0x500507630708d3b3"] }

    it "returns the list of found WWPNs for the given channel" do
      expect(subject.find_wwpns("0.0.fa00")).to contain_exactly(*wwpns)
    end
  end

  describe "#find_luns" do
    before do
      allow(yast_zfcp)
        .to receive(:find_luns).with("0.0.fa00", "0x500507630708d3b3").and_return(output)
    end

    let(:output) { { "stdout" => luns } }

    let(:luns) { ["0x0013000000000000", "0x0000000000000001", "0x0013000000000002"] }

    it "returns the list of found LUNs for the given channel and WWPN" do
      expect(subject.find_luns("0.0.fa00", "0x500507630708d3b3")).to contain_exactly(*luns)
    end
  end
end
