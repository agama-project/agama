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
require "agama/dbus/clients/network"

describe Agama::DBus::Clients::Network do
  before do
    allow(DBus::SystemBus).to receive(:instance).and_return(bus)
    allow(bus).to receive(:service).with("org.freedesktop.NetworkManager").and_return(service)
    allow(service).to receive(:[]).with("/org/freedesktop/NetworkManager")
      .and_return(dbus_object)
    allow(dbus_object).to receive(:introspect)
    allow(dbus_object).to receive(:[]).with("org.freedesktop.NetworkManager")
      .and_return(network_iface)
  end

  let(:bus) { instance_double(DBus::SystemBus) }
  let(:service) { instance_double(DBus::Service) }
  let(:dbus_object) { instance_double(DBus::ProxyObject) }
  let(:network_iface) { instance_double(DBus::ProxyObjectInterface) }

  describe "#on_connection_changed" do
    it "registers a callback for the StateChanged signal" do
      expect(network_iface).to receive(:on_signal).with("StateChanged")
      subject.on_connection_changed { "test" }
    end
  end
end
