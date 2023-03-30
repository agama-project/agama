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
require "agama/dbus/clients/language"
require "dbus"

describe Agama::DBus::Clients::Language do
  before do
    allow(Agama::DBus::Bus).to receive(:current).and_return(bus)
    allow(bus).to receive(:service).with("org.opensuse.Agama.Language1").and_return(service)
    allow(service).to receive(:object).with("/org/opensuse/Agama/Language1")
      .and_return(dbus_object)
    allow(dbus_object).to receive(:introspect)
    allow(dbus_object).to receive(:[]).with("org.opensuse.Agama.Language1")
      .and_return(lang_iface)
  end

  let(:bus) { instance_double(Agama::DBus::Bus) }
  let(:service) { instance_double(::DBus::Service) }
  let(:dbus_object) { instance_double(::DBus::ProxyObject) }
  let(:lang_iface) { instance_double(::DBus::ProxyObjectInterface) }

  subject { described_class.new }

  describe "#available_languages" do
    before do
      allow(lang_iface).to receive(:[]).with("AvailableLanguages").and_return(
        [
          ["en_US", "English (US)", {}],
          ["en_GB", "English (UK)", {}],
          ["es_ES", "Español", {}]
        ]
      )
    end

    it "returns the id and name for all available languages" do
      expect(subject.available_languages).to contain_exactly(
        ["en_US", "English (US)"],
        ["en_GB", "English (UK)"],
        ["es_ES", "Español"]
      )
    end
  end

  describe "#selected_languages" do
    before do
      allow(lang_iface).to receive(:[]).with("MarkedForInstall").and_return(["en_US", "es_ES"])
    end

    it "returns the name of the selected languages" do
      expect(subject.selected_languages).to contain_exactly("en_US", "es_ES")
    end
  end

  describe "#select_languages" do
    # Using partial double because methods are dynamically added to the proxy object
    let(:dbus_object) { double(::DBus::ProxyObject) }

    it "selects the given languages" do
      expect(dbus_object).to receive(:ToInstall).with(["en_GB"])

      subject.select_languages(["en_GB"])
    end
  end

  describe "#finish" do
    let(:dbus_object) { double(::DBus::ProxyObject) }

    it "calls the D-Bus finish method" do
      expect(dbus_object).to receive(:Finish)
      subject.finish
    end
  end
end
