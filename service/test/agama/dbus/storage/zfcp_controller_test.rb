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
require "agama/dbus/storage/zfcp_controller"
require "agama/storage/zfcp/manager"
require "agama/storage/zfcp/controller"

describe Agama::DBus::Storage::ZFCPController do
  subject { described_class.new(manager, controller1, path, logger: logger) }

  let(:manager) { Agama::Storage::ZFCP::Manager.new(logger: logger) }

  let(:controller1) { Agama::Storage::ZFCP::Controller.new("0.0.fa00") }

  let(:path) { "/org/opensuse/Agama/Storage1/zfcp_controllers/1" }

  let(:logger) { Logger.new($stdout, level: :warn) }

  before do
    allow(subject).to receive(:dbus_properties_changed)
  end

  describe "#active" do
    before do
      controller1.active = active
    end

    context "if the controller is active" do
      let(:active) { true }

      it "returns true" do
        expect(subject.active).to eq(true)
      end
    end

    context "if the controller is not active" do
      let(:active) { false }

      it "returns false" do
        expect(subject.active).to eq(false)
      end
    end
  end

  describe "#channel" do
    it "returns the channel id of the controller" do
      expect(subject.channel).to eq("0.0.fa00")
    end
  end

  describe "#find_wwpns" do
    before do
      allow(manager).to receive(:find_wwpns).with("0.0.fa00").and_return(wwpns)
    end

    let(:wwpns) { ["0x500507630708d3b3", "0x500507630703d3b3"] }

    it "returns the available WWPNs of the controller" do
      expect(subject.find_wwpns).to contain_exactly(*wwpns)
    end
  end

  describe "#find_luns" do
    before do
      allow(manager).to receive(:find_luns).with("0.0.fa00", "0x500507630708d3b3").and_return(luns)
    end

    let(:luns) { ["0x0000000000000000", "0x0000000000000001", "0x0000000000000002"] }

    it "returns the available LUNs for the given WWPN of the controller" do
      expect(subject.find_luns("0x500507630708d3b3")).to contain_exactly(*luns)
    end
  end

  describe "#activate" do
    it "tries to activate the controller and returns the exit code" do
      expect(manager).to receive(:activate_controller).with("0.0.fa00").and_return(0)

      expect(subject.activate).to eq(0)
    end
  end

  describe "#activate_disk" do
    it "tries to activate the indicated zFCP disk and returns the exit code" do
      expect(manager).to receive(:activate_disk)
        .with("0.0.fa00", "0x500507630708d3b3", "0x0000000000000001").and_return(0)

      expect(subject.activate_disk("0x500507630708d3b3", "0x0000000000000001")).to eq(0)
    end
  end

  describe "#deactivate_disk" do
    it "tries to deactivates the indicated zFCP disk and returns the exit code" do
      expect(manager).to receive(:deactivate_disk)
        .with("0.0.fa00", "0x500507630708d3b3", "0x0000000000000001").and_return(1)

      expect(subject.deactivate_disk("0x500507630708d3b3", "0x0000000000000001")).to eq(1)
    end
  end

  describe "#controller=" do
    let(:controller2) { Agama::Storage::ZFCP::Controller.new("0.0.fc00") }

    it "sets the represented zFCP controller" do
      expect(subject.controller).to_not eq(controller2)

      subject.controller = controller2

      expect(subject.controller).to eq(controller2)
    end

    context "if the given controller is different to the current one" do
      let(:controller2) do
        Agama::Storage::ZFCP::Controller.new("0.0.fa00").tap { |c| c.active = true }
      end

      it "emits properties changed signal" do
        expect(subject).to receive(:dbus_properties_changed)

        subject.controller = controller2
      end
    end

    context "if the given controller is equal to the current one" do
      let(:controller2) { Agama::Storage::ZFCP::Controller.new("0.0.fa00") }

      it "does not emit properties changed signal" do
        expect(subject).to_not receive(:dbus_properties_changed)

        subject.controller = controller2
      end
    end
  end
end
