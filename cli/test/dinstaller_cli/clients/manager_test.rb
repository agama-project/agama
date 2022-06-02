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

require_relative "../../test_helper"
require "dinstaller_cli/clients/manager"
require "dbus"

describe DInstallerCli::Clients::Manager do
  before do
    allow(::DBus::SystemBus).to receive(:instance).and_return(bus)
    allow(bus).to receive(:service).with("org.opensuse.DInstaller").and_return(service)
    allow(service).to receive(:object).with("/org/opensuse/DInstaller/Manager1")
      .and_return(dbus_object)
    allow(dbus_object).to receive(:introspect)
    allow(dbus_object).to receive(:[]).with("org.opensuse.DInstaller.Manager1")
      .and_return(manager_iface)
    allow(dbus_object).to receive(:[]).with("org.freedesktop.DBus.Properties")
      .and_return(properties_iface)
  end

  let(:bus) { instance_double(::DBus::SystemBus) }
  let(:service) { instance_double(::DBus::Service) }
  let(:dbus_object) { instance_double(::DBus::ProxyObject) }
  let(:manager_iface) { instance_double(::DBus::ProxyObjectInterface) }
  let(:properties_iface) { instance_double(::DBus::ProxyObjectInterface, on_signal: nil) }

  subject { described_class.new }

  describe "#commit" do
    # Using partial double because methods are dynamically added to the proxy object
    let(:dbus_object) { double(::DBus::ProxyObject) }

    it "starts the installation" do
      expect(dbus_object).to receive(:Commit)

      subject.commit
    end
  end

  describe "#status" do
    before do
      allow(manager_iface).to receive(:[]).with("Status").and_return(2)
    end

    it "returns the installation status" do
      expect(subject.status).to eq(2)
    end
  end
end
