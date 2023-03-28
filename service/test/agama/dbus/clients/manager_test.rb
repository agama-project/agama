# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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
require_relative "with_service_status_examples"
require_relative "with_progress_examples"
require "dbus"
require "agama/dbus/clients/manager"
require "agama/dbus/manager"
require "agama/installation_phase"

describe Agama::DBus::Clients::Manager do
  before do
    allow(Agama::DBus::Bus).to receive(:current).and_return(bus)
    allow(bus).to receive(:service).with("org.opensuse.DInstaller").and_return(service)
    allow(service).to receive(:[]).with("/org/opensuse/DInstaller/Manager1")
      .and_return(dbus_object)
    allow(dbus_object).to receive(:introspect)
    allow(dbus_object).to receive(:[]).with("org.opensuse.DInstaller.Manager1")
      .and_return(manager_iface)
    allow(dbus_object).to receive(:[]).with("org.freedesktop.DBus.Properties")
      .and_return(properties_iface)
  end

  let(:bus) { instance_double(Agama::DBus::Bus) }
  let(:service) { instance_double(::DBus::Service) }
  let(:dbus_object) { instance_double(::DBus::ProxyObject) }
  let(:manager_iface) { instance_double(::DBus::ProxyObjectInterface) }
  let(:properties_iface) { instance_double(::DBus::ProxyObjectInterface, on_signal: nil) }

  subject { described_class.new }

  describe "#Probe" do
    # Using partial double because methods are dynamically added to the proxy object
    let(:dbus_object) { double(::DBus::ProxyObject) }

    it "starts the config phase" do
      expect(dbus_object).to receive(:Probe)

      subject.probe
    end
  end

  describe "#commit" do
    # Using partial double because methods are dynamically added to the proxy object
    let(:dbus_object) { double(::DBus::ProxyObject) }

    it "starts the install phase" do
      expect(dbus_object).to receive(:Commit)

      subject.commit
    end
  end

  describe "#current_installation_phase" do
    before do
      expect(manager_iface).to receive(:[]).with("CurrentInstallationPhase")
        .and_return(current_phase)
    end

    context "when the current phase is startup" do
      let(:current_phase) { Agama::DBus::Manager::STARTUP_PHASE }

      it "returns the startup phase value" do
        expect(subject.current_installation_phase).to eq(Agama::InstallationPhase::STARTUP)
      end
    end

    context "when the current phase is config" do
      let(:current_phase) { Agama::DBus::Manager::CONFIG_PHASE }

      it "returns the config phase value" do
        expect(subject.current_installation_phase).to eq(Agama::InstallationPhase::CONFIG)
      end
    end

    context "when the current phase is install" do
      let(:current_phase) { Agama::DBus::Manager::INSTALL_PHASE }

      it "returns the install phase value" do
        expect(subject.current_installation_phase).to eq(Agama::InstallationPhase::INSTALL)
      end
    end
  end

  include_examples "service status"
  include_examples "progress"
end
