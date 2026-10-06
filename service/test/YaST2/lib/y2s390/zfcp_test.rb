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
require "y2s390/zfcp"
require "yaml"

describe Y2S390::ZFCP do
  def fixture(name)
    YAML.safe_load(File.read(File.join(FIXTURES_PATH, "yast2", "y2s390", name)))
  end

  describe "#allow_lun_scan?" do
    before do
      allow(File).to receive(:exist?)
        .with("/sys/module/zfcp/parameters/allow_lun_scan")
        .and_return(true)

      allow(Yast::SCR).to receive(:Read)
        .with(anything, "/sys/module/zfcp/parameters/allow_lun_scan")
        .and_return(allow_lun_scan)
    end

    context "if allow_lun_scan is active" do
      let(:allow_lun_scan) { "Y" }

      it "returns true" do
        expect(subject.allow_lun_scan?).to eq(true)
      end
    end

    context "if allow_lun_scan is not active" do
      let(:allow_lun_scan) { "N" }

      it "returns false" do
        expect(subject.allow_lun_scan?).to eq(false)
      end
    end
  end

  describe "#probe_controllers" do
    before do
      allow(Yast::SCR).to receive(:Read).with(Yast.path(".probe.storage"))
        .and_return(controllers_data)

      allow(Yast::SCR).to receive(:Execute).with(anything, /\/sbin\/vmcp q v fcp/)
        .and_return(vmcp_output)

      allow(Yast::SCR).to receive(:Execute).with(anything, /\/sbin\/cio_ignore -r/)
        .and_return("exit" => 0, "stdout" => "")
    end

    let(:controllers_data) { fixture("probe_storage.yml") }

    let(:vmcp_output) do
      {
        "exit"   => 0,
        "stdout" => "FCP  F800 ON FCP   F807 CHPID 1C SUBCHANNEL = 000B\n" \
                    "F800 TOKEN = 0000000362A42C00"
      }
    end

    it "removes all FCP devices from the blacklist" do
      expect(Yast::SCR).to receive(:Execute).with(anything, /\/sbin\/cio_ignore -r f800/)

      subject.probe_controllers
    end

    it "reads all the zFCP controllers" do
      expect(subject.controllers).to eq([])

      subject.probe_controllers

      expect(subject.controllers).to contain_exactly(
        hash_including("sysfs_bus_id" => "0.0.f800"),
        hash_including("sysfs_bus_id" => "0.0.f900"),
        hash_including("sysfs_bus_id" => "0.0.fa00"),
        hash_including("sysfs_bus_id" => "0.0.fc00")
      )
    end
  end

  describe "#probe_disks" do
    before do
      allow(Yast::SCR).to receive(:Read).with(Yast.path(".probe.disk"))
        .and_return(disks_data)

      allow(Yast::SCR).to receive(:Read).with(Yast.path(".probe.tape")).and_return([])
    end

    let(:disks_data) { fixture("probe_disk.yml") }

    it "reads all the zFCP disks" do
      expect(subject.disks).to eq([])

      subject.probe_disks

      expect(subject.disks).to contain_exactly(
        hash_including("dev_name" => "/dev/sda"),
        hash_including("dev_name" => "/dev/sdb")
      )
    end
  end

  describe "#activate_controller" do
    before do
      allow(Yast::SCR).to receive(:Execute).with(anything, command).and_return(output)
    end

    let(:command) { /\/sbin\/zfcp_host_configure '0.0.fc00' 1/ }

    let(:output) { { "exit" => 0, "stdout" => "" } }

    it "tries to activate the given controller" do
      expect(Yast::SCR).to receive(:Execute).with(anything, command)

      subject.activate_controller("0.0.fc00")
    end

    it "returns the output of the command" do
      result = subject.activate_controller("0.0.fc00")

      expect(result).to eq(output)
    end
  end

  describe "#activated_controller?" do
    before do
      allow(subject).to receive(:controllers).and_return(controllers)
    end

    let(:controllers) do
      [
        {
          "sysfs_bus_id" => "0.0.fa00",
          "resource"     => { "io" => [{ "active" => true }] }
        },
        {
          "sysfs_bus_id" => "0.0.fc00",
          "resource"     => { "io" => [{ "active" => false }] }
        }
      ]
    end

    context "if the given controller is activated" do
      let(:channel) { "0.0.fa00" }

      it "returns true" do
        expect(subject.activated_controller?(channel)).to eq(true)
      end
    end

    context "if the given controller is not activated" do
      let(:channel) { "0.0.fc00" }

      it "returns false" do
        expect(subject.activated_controller?(channel)).to eq(false)
      end
    end
  end

  describe "#lun_scan_controller?" do
    before do
      allow(subject).to receive(:allow_lun_scan?).and_return(allow_lun_scan)

      allow(Yast::SCR).to receive(:Read)
        .with(anything, "/sys/module/zfcp/parameters/allow_lun_scan")
        .and_return(allow_lun_scan)

      allow(Dir).to receive(:[])
        .with("/sys/bus/ccw/drivers/zfcp/0.0.fa00/host*/fc_host/host*/port_type")
        .and_return(port_type_files)
    end

    let(:allow_lun_scan) { nil }

    let(:port_type_files) { [] }

    let(:controller_mode) { nil }

    context "if allow_lun_scan is not active" do
      let(:allow_lun_scan) { false }

      it "returns false" do
        expect(subject.lun_scan_controller?("0.0.fa00")).to eq(false)
      end
    end

    context "if allow_lun_scan is active and the controller is not active" do
      let(:allow_lun_scan) { true }

      let(:port_type_files) { [] }

      it "returns false" do
        expect(subject.lun_scan_controller?("0.0.fa00")).to eq(false)
      end
    end

    context "if allow_lun_scan is active and the controller is active" do
      let(:allow_lun_scan) { true }

      let(:port_type_files) { ["/sys/bus/ccw/drivers/zfcp/0.0.fa00/host0/fc_host/host0/port_type"] }

      before do
        allow(Yast::SCR).to receive(:Read)
          .with(anything, "/sys/bus/ccw/drivers/zfcp/0.0.fa00/host0/fc_host/host0/port_type")
          .and_return(controller_mode)
      end

      context "and the controller is not running in NPIV mode" do
        let(:controller_mode) { "" }

        it "returns false" do
          expect(subject.lun_scan_controller?("0.0.fa00")).to eq(false)
        end
      end

      context "and the controller is running in NPIV mode" do
        let(:controller_mode) { "NPIV VPORT" }

        it "returns true" do
          expect(subject.lun_scan_controller?("0.0.fa00")).to eq(true)
        end
      end
    end
  end

  describe "#activate_disk" do
    before do
      allow(Yast::SCR).to receive(:Execute).with(anything, command).and_return(output)
    end

    let(:command) do
      /\/sbin\/zfcp_disk_configure '0.0.fc00' '0x500507630708d3b3' '0x0000000000000005' 1/
    end

    let(:output) { { "exit" => 1, "stdout" => "An error" } }

    it "tries to activate a zFCP disk" do
      expect(Yast::SCR).to receive(:Execute).with(anything, command)

      subject.activate_disk("0.0.fc00", "0x500507630708d3b3", "0x0000000000000005")
    end

    it "returns the output of the command" do
      result = subject.activate_disk("0.0.fc00", "0x500507630708d3b3", "0x0000000000000005")

      expect(result).to eq(output)
    end
  end

  describe "#deactivate_disk" do
    before do
      allow(Yast::SCR).to receive(:Execute).with(anything, command).and_return(output)
    end

    let(:command) do
      /\/sbin\/zfcp_disk_configure '0.0.fc00' '0x500507630708d3b3' '0x0000000000000005' 0/
    end

    let(:output) { { "exit" => 0, "stdout" => "" } }

    it "tries to deactivate a zFCP disk" do
      expect(Yast::SCR).to receive(:Execute).with(anything, command)

      subject.deactivate_disk("0.0.fc00", "0x500507630708d3b3", "0x0000000000000005")
    end

    it "returns the output of the command" do
      result = subject.deactivate_disk("0.0.fc00", "0x500507630708d3b3", "0x0000000000000005")

      expect(result).to eq(output)
    end
  end

  describe "#find_wwpns" do
    before do
      allow(Yast::SCR).to receive(:Execute).with(anything, command).and_return(output)
    end

    let(:command) { /zfcp_san_disc -b '0.0.fc00' -W/ }

    let(:output) { { "exit" => 0, "stdout" => "0x500507630703d3b3\n0x500507630708d3b3" } }

    it "runs the command for finding WWPNs" do
      expect(Yast::SCR).to receive(:Execute).with(anything, command)

      subject.find_wwpns("0.0.fc00")
    end

    it "returns the output of the command" do
      result = subject.find_wwpns("0.0.fc00")

      expect(result).to eq(
        "exit"   => 0,
        "stdout" => ["0x500507630703d3b3", "0x500507630708d3b3"]
      )
    end
  end

  describe "#find_luns" do
    before do
      allow(Yast::SCR).to receive(:Execute).with(anything, command).and_return(output)
    end

    let(:command) { /zfcp_san_disc -b '0.0.fc00' -p '0x500507630708d3b3' -L/ }

    let(:output) { { "exit" => 0, "stdout" => "0x0000000000000005\n0x0000000000000006" } }

    it "runs the command for finding LUNs" do
      expect(Yast::SCR).to receive(:Execute).with(anything, command)

      subject.find_luns("0.0.fc00", "0x500507630708d3b3")
    end

    it "returns the output of the command" do
      result = subject.find_luns("0.0.fc00", "0x500507630708d3b3")

      expect(result).to eq(
        "exit"   => 0,
        "stdout" => ["0x0000000000000005", "0x0000000000000006"]
      )
    end
  end
end
