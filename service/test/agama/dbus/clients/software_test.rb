# frozen_string_literal: true

# Copyright (c) [2022-2024] SUSE LLC
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
require_relative "with_issues_examples"
require_relative "with_service_status_examples"
require_relative "with_progress_examples"
require "agama/dbus/clients/software"
require "agama/dbus/service_status"
require "agama/dbus/interfaces/service_status"
require "dbus"

describe Agama::DBus::Clients::Software do
  before do
    allow(Agama::DBus::Bus).to receive(:current).and_return(bus)
    allow(bus).to receive(:service).with("org.opensuse.Agama.Software1").and_return(service)
    allow(service).to receive(:[]).with("/org/opensuse/Agama/Software1")
      .and_return(dbus_object)
    allow(service).to receive(:[]).with("/org/opensuse/Agama/Software1/Product")
      .and_return(dbus_product)
    allow(service).to receive(:[]).with("/org/opensuse/Agama/Software1/Proposal")
      .and_return(dbus_proposal)
    allow(dbus_object).to receive(:[]).with("org.opensuse.Agama.Software1")
      .and_return(software_iface)
    allow(dbus_product).to receive(:[]).with("org.opensuse.Agama.Software1.Product")
      .and_return(product_iface)
    allow(dbus_product).to receive(:[]).with("org.freedesktop.DBus.Properties")
      .and_return(properties_iface)
  end

  let(:bus) { instance_double(Agama::DBus::Bus) }
  let(:service) { instance_double(::DBus::ProxyService) }
  let(:dbus_object) { instance_double(::DBus::ProxyObject, introspect: nil) }
  let(:dbus_product) { instance_double(::DBus::ProxyObject, introspect: nil) }
  let(:dbus_proposal) { instance_double(::DBus::ProxyObject, introspect: nil) }
  let(:software_iface) { instance_double(::DBus::ProxyObjectInterface) }
  let(:properties_iface) { instance_double(::DBus::ProxyObjectInterface) }
  let(:product_iface) { instance_double(::DBus::ProxyObjectInterface) }

  subject { described_class.new }

  describe "#available_products" do
    before do
      allow(product_iface).to receive(:[]).with("AvailableProducts").and_return(
        [
          ["Tumbleweed", "openSUSE Tumbleweed", {}],
          ["Leap15.3", "openSUSE Leap 15.3", {}]
        ]
      )
    end

    it "returns the name and display name for all available products" do
      expect(subject.available_products).to contain_exactly(
        ["Tumbleweed", "openSUSE Tumbleweed"],
        ["Leap15.3", "openSUSE Leap 15.3"]
      )
    end
  end

  describe "#selected_product" do
    before do
      allow(product_iface).to receive(:[]).with("SelectedProduct").and_return(product)
    end

    context "when there is no selected product" do
      let(:product) { "" }

      it "returns nil" do
        expect(subject.selected_product).to be_nil
      end
    end

    context "when there is a selected product" do
      let(:product) { "Tumbleweed" }

      it "returns the name of the selected product" do
        expect(subject.selected_product).to eq("Tumbleweed")
      end
    end
  end

  describe "#select_product" do
    # Using partial double because methods are dynamically added to the proxy object
    let(:dbus_product) { double(::DBus::ProxyObject, introspect: nil) }

    it "selects the given product" do
      expect(dbus_product).to receive(:SelectProduct).with("Tumbleweed")

      subject.select_product("Tumbleweed")
    end
  end

  describe "#probe" do
    let(:dbus_object) { double(::DBus::ProxyObject, introspect: nil, Probe: nil) }

    it "calls the D-Bus Probe method" do
      expect(dbus_object).to receive(:Probe)

      subject.probe
    end

    context "when a block is given" do
      it "passes the block to the Probe method (async)" do
        callback = proc {}
        expect(dbus_object).to receive(:Probe) do |&block|
          expect(block).to be(callback)
        end

        subject.probe(&callback)
      end
    end
  end

  describe "#provisions_selected" do
    let(:dbus_object) { double(::DBus::ProxyObject, introspect: nil) }

    it "returns true/false for every tag given" do
      expect(dbus_object).to receive(:ProvisionsSelected)
        .with(["sddm", "gdm"]).and_return([true, false])
      expect(subject.provisions_selected?(["sddm", "gdm"]))
        .to eq([true, false])
    end
  end

  describe "#package_installed?" do
    let(:dbus_object) do
      double(::DBus::ProxyObject, introspect: nil, IsPackageInstalled: installed?)
    end

    let(:package) { "NetworkManager" }

    context "when the package is installed" do
      let(:installed?) { true }

      it "returns true" do
        expect(subject.package_installed?(package)).to eq(true)
      end
    end

    context "when the package is installed" do
      let(:installed?) { false }

      it "returns false" do
        expect(subject.package_installed?(package)).to eq(false)
      end
    end
  end

  describe "#package_available?" do
    let(:dbus_object) do
      double(::DBus::ProxyObject, introspect: nil, IsPackageAvailable: available)
    end

    let(:package) { "NetworkManager" }

    context "when the package is available" do
      let(:available) { true }

      it "returns true" do
        expect(subject.package_available?(package)).to eq(true)
      end
    end

    context "when the package is available" do
      let(:available) { false }

      it "returns false" do
        expect(subject.package_available?(package)).to eq(false)
      end
    end
  end

  describe "#on_product_selected" do
    before do
      allow(dbus_product).to receive(:path).and_return("/org/opensuse/Agama/Test")
      allow(properties_iface).to receive(:on_signal)
    end

    context "if there are no callbacks for changes in properties" do
      it "subscribes to properties change signal" do
        expect(properties_iface).to receive(:on_signal)
        subject.on_product_selected { "test" }
      end
    end

    context "if there already are callbacks for changes in properties" do
      before do
        subject.on_product_selected { "test" }
      end

      it "does not subscribe to properties change signal again" do
        expect(properties_iface).to_not receive(:on_signal)
        subject.on_product_selected { "test" }
      end
    end
  end

  describe "#on_probe_finished" do
    before do
      allow(dbus_object).to receive(:path).and_return("/org/opensuse/Agama/Test")
      allow(software_iface).to receive(:on_signal)
    end

    context "if there are no callbacks for the signal" do
      it "subscribes to the signal" do
        expect(software_iface).to receive(:on_signal)
        subject.on_probe_finished { "test" }
      end
    end

    context "if there already are callbacks for the signal" do
      before do
        subject.on_probe_finished { "test" }
      end

      it "does not subscribe to the signal again" do
        expect(software_iface).to_not receive(:on_signal)
        subject.on_probe_finished { "test" }
      end
    end
  end

  include_examples "issues"
  include_examples "service status"
  include_examples "progress"
end
