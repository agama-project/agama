# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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
require_relative "with_validation_examples"
require "agama/dbus/clients/storage"
require "dbus"

describe DInstaller::DBus::Clients::Storage do
  before do
    allow(DInstaller::DBus::Bus).to receive(:current).and_return(bus)
    allow(bus).to receive(:service).with("org.opensuse.DInstaller.Storage").and_return(service)

    allow(service).to receive(:[]).with("/org/opensuse/DInstaller/Storage1")
      .and_return(dbus_object)
    allow(dbus_object).to receive(:introspect)
    allow(dbus_object).to receive(:[]).with("org.opensuse.DInstaller.Storage1")
      .and_return(storage_iface)
    allow(dbus_object).to receive(:[]).with("org.opensuse.DInstaller.Storage1.Proposal.Calculator")
      .and_return(proposal_calculator_iface)

    allow(service).to receive(:object).with("/org/opensuse/DInstaller/Storage1/Proposal")
      .and_return(dbus_proposal)
    allow(dbus_proposal).to receive(:introspect)
    allow(dbus_proposal).to receive(:[]).with("org.opensuse.DInstaller.Storage1.Proposal")
      .and_return(proposal_iface)

    allow(proposal_calculator_iface).to receive(:[]).with("Result").and_return(proposal_path)
  end

  let(:bus) { instance_double(DInstaller::DBus::Bus) }
  let(:service) { instance_double(::DBus::Service) }

  let(:dbus_object) { instance_double(::DBus::ProxyObject) }
  let(:storage_iface) { instance_double(::DBus::ProxyObjectInterface) }
  let(:proposal_calculator_iface) { instance_double(::DBus::ProxyObjectInterface) }

  let(:dbus_proposal) { instance_double(::DBus::ProxyObject) }
  let(:proposal_iface) { instance_double(::DBus::ProxyObjectInterface) }

  let(:proposal_path) { "/" }

  subject { described_class.new }

  describe "#probe" do
    let(:storage_iface) { double(::DBus::ProxyObjectInterface, Probe: nil) }

    it "calls the D-Bus Probe method" do
      expect(storage_iface).to receive(:Probe)

      subject.probe
    end

    context "when a block is given" do
      it "passes the block to the Probe method (async)" do
        callback = proc {}
        expect(storage_iface).to receive(:Probe) do |&block|
          expect(block).to be(callback)
        end

        subject.probe(&callback)
      end
    end
  end

  describe "#install" do
    let(:dbus_object) { double(::DBus::ProxyObject, Install: nil) }

    it "calls the D-Bus Install method" do
      expect(dbus_object).to receive(:Install)

      subject.install
    end
  end

  describe "#finish" do
    let(:dbus_object) { double(::DBus::ProxyObject, Finish: nil) }

    it "calls the D-Bus Install method" do
      expect(dbus_object).to receive(:Finish)

      subject.finish
    end
  end

  describe "#available_devices" do
    before do
      allow(proposal_calculator_iface).to receive(:[]).with("AvailableDevices").and_return(
        [
          ["/dev/sda", "/dev/sda (50 GiB)"],
          ["/dev/sdb", "/dev/sda (20 GiB)"]
        ]
      )
    end

    it "returns the name of all available devices for the installation" do
      expect(subject.available_devices).to contain_exactly("/dev/sda", "/dev/sdb")
    end
  end

  describe "#candidate_devices" do
    context "if a proposal object is not exported yet" do
      let(:proposal_path) { "/" }

      it "returns an empty list" do
        expect(subject.candidate_devices).to eq([])
      end
    end

    context "if a proposal object is already exported" do
      let(:proposal_path) { "/org/opensuse/DInstaller/Storage1/Proposal" }

      before do
        allow(proposal_iface).to receive(:[]).with("CandidateDevices").and_return(["/dev/sda"])
      end

      it "returns the name of the candidate devices for the installation" do
        expect(subject.candidate_devices).to contain_exactly("/dev/sda")
      end
    end
  end

  describe "#calculate" do
    # Using partial double because methods are dynamically added to the proxy object
    let(:proposal_calculator_iface) { double(::DBus::ProxyObjectInterface) }

    it "calculates the proposal with the given devices" do
      expect(proposal_calculator_iface)
        .to receive(:Calculate).with({ "CandidateDevices" => ["/dev/sdb"] })

      subject.calculate(["/dev/sdb"])
    end
  end

  describe "#actions" do
    context "if a proposal object is not exported yet" do
      let(:proposal_path) { "/" }

      it "returns an empty list" do
        expect(subject.actions).to eq([])
      end
    end

    context "if a proposal object is already exported" do
      let(:proposal_path) { "/org/opensuse/DInstaller/Storage1/Proposal" }

      before do
        allow(proposal_iface).to receive(:[]).with("Actions").and_return(
          [
            {
              "Text"      => "Create GPT on /dev/vdc",
              "Subvolume" => false
            },
            {
              "Text"      => "Create partition /dev/vdc1 (8.00 MiB) as BIOS Boot Partition",
              "Subvolume" => false
            },
            {
              "Text"      => "Create partition /dev/vdc2 (27.99 GiB) for / with btrfs",
              "Subvolume" => false
            },
            {
              "Text"      => "Create partition /dev/vdc3 (2.00 GiB) for swap",
              "Subvolume" => false
            }
          ]
        )
      end

      it "returns the actions to perform" do
        expect(subject.actions).to include(/Create GPT/)
        expect(subject.actions).to include(/Create partition \/dev\/vdc1/)
        expect(subject.actions).to include(/Create partition \/dev\/vdc2/)
        expect(subject.actions).to include(/Create partition \/dev\/vdc3/)
      end
    end
  end

  include_examples "validation"
end
