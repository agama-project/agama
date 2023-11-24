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
require "agama/dbus/clients/locale"
require "dbus"

describe Agama::DBus::Clients::Locale do
  before do
    allow(Agama::DBus::Bus).to receive(:current).and_return(bus)
    allow(bus).to receive(:service).with("org.opensuse.Agama1").and_return(service)
    allow(service).to receive(:object).with("/org/opensuse/Agama1/Locale")
      .and_return(dbus_object)
    allow(dbus_object).to receive(:introspect)
    allow(dbus_object).to receive(:[]).with("org.opensuse.Agama1.Locale")
      .and_return(lang_iface)
  end

  let(:bus) { instance_double(Agama::DBus::Bus) }
  let(:service) { instance_double(DBus::ProxyService) }
  let(:dbus_object) { instance_double(DBus::ProxyObject) }
  let(:lang_iface) { instance_double(DBus::ProxyObjectInterface) }

  subject { described_class.instance }

  describe "#finish" do
    let(:dbus_object) { double(DBus::ProxyObject) }

    it "calls the D-Bus finish method" do
      expect(dbus_object).to receive(:Commit)
      subject.finish
    end
  end
end
