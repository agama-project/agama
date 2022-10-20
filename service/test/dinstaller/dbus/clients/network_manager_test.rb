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
require "dinstaller/dbus/clients/network_manager"

describe DInstaller::DBus::Clients::NetworkManager do
  before do
    allow(::DBus::SystemBus).to receive(:instance).and_return(bus)
    allow(service).to receive(:object).with("/org/freedesktop/NetworkManager")
      .and_return(dbus_object)
    allow(service).to receive(:object).with(active_connection_path)
      .and_return(connection_object)
    allow(service).to receive(:object).with(settings_path)
      .and_return(settings_object)
    allow(dbus_object).to receive(:introspect)

    allow(dbus_object).to receive(:[]).with("org.freedesktop.NetworkManager")
      .and_return(network_iface)
    allow(connection_object).to receive(:[]).with("org.freedesktop.NetworkManager.Connection.Active")
      .and_return(connection_iface)
    allow(settings_object).to receive(:[]).with("org.freedesktop.NetworkManager.Settings.Connection")
      .and_return(settings_iface)

    allow(network_iface).to receive(:[]).with("ActiveConnections").and_return(active_connections)
    allow(connection_iface).to receive(:[]) { |k| connection_data[k] }
  end


  let(:bus) { instance_double(::DBus::SystemBus, service: service) }
  let(:service) { instance_double(::DBus::Service) }
  let(:dbus_object) { instance_double(::DBus::ProxyObject) }
  let(:network_iface) { instance_double(::DBus::ProxyObjectInterface, ) }
  let(:settings_iface) { instance_double(::DBus::ProxyObjectInterface) }

  let(:connection_object) { instance_double(::DBus::ProxyObject) }
  let(:connection_iface) { instance_double(::DBus::ProxyObjectInterface) }
  let(:connection_data) do
    { "Id" => "enp1s0", "Type" => "802-3-ethernet", "State" => 2, "Connection" => settings_path }
  end

  let(:settings_object) { instance_double(::DBus::ProxyObject) }
  let(:settings_iface) { double(::DBus::ProxyObjectInterface, GetSettings: [settings_data]) }
  let(:settings_data) do
    { "ipv4" => { "method" => "auto", "address-data" => addresses, "gateway" => "192.168.122.1" } }
  end
  let(:addresses) do
  [ { "address" => "192.168.122.10", "prefix" => 24 }]
  end

  let(:active_connection_path) { "/org/freedesktop/NetworkManager/ActiveConnection/1" }
  let(:active_connections) { [active_connection_path] }
  let(:settings_path) { "/org/freedesktop/NetworkManager/Settings/1" }

  describe "#active_connections" do
    it "returns an array of NetworkManager active connections" do
      connections = subject.active_connections
      expected_connection = DInstaller::Network::Connection.new(
        connection_data["Id"],
        active_connection_path,
        connection_data["Type"],
        connection_data["State"],
        DInstaller::Network::IPConfig.new(
          settings_data["ipv4"]["method"],
          addresses,
          settings_data["ipv4"]["gateway"]
        )
      )
      expect(connections).to eq([expected_connection])
    end
  end
end
