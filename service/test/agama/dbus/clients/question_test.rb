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
require "agama/dbus/clients/question"
require "dbus"

describe Agama::DBus::Clients::Question do
  before do
    allow(Agama::DBus::Bus).to receive(:current).and_return(bus)
    allow(bus).to receive(:service).with("org.opensuse.Agama.Questions1").and_return(service)
    allow(service).to receive(:[]).with("/org/opensuse/Agama/Questions1/23")
      .and_return(dbus_object)
    allow(dbus_object).to receive(:[]).with("org.opensuse.Agama.Questions1.Generic")
      .and_return(generic_iface)
    allow(dbus_object).to receive(:[]).with("org.opensuse.Agama.Questions1.LuksActivation")
      .and_return(luks_iface)
    allow(dbus_object).to receive(:has_iface?).with(/LuksActivation/).and_return(luks_iface?)
  end

  let(:bus) { instance_double(Agama::DBus::Bus) }
  let(:service) { instance_double(::DBus::ProxyService) }
  let(:dbus_object) { instance_double(::DBus::ProxyObject) }
  let(:generic_iface) { instance_double(::DBus::ProxyObjectInterface) }
  let(:luks_iface) { instance_double(::DBus::ProxyObjectInterface) }
  let(:luks_iface?) { true }

  subject { described_class.new("/org/opensuse/Agama/Questions1/23") }

  describe "#answered?" do
    it "returns false if there is no answer" do
      expect(generic_iface).to receive(:[]).with("Answer").and_return("")
      expect(subject.answered?).to eq false
    end
  end

  describe "#text" do
    it "returns the appropriate property" do
      expect(generic_iface).to receive(:[]).with("Text").and_return("the text")
      expect(subject.text).to eq "the text"
    end
  end

  describe "#password" do
    it "returns the appropriate property of the luks interface" do
      expect(luks_iface).to receive(:[]).with("Password").and_return("the password")
      expect(subject.password).to eq "the password"
    end

    context "when the luks interface is missing" do
      let(:luks_iface?) { false }

      it "returns nil" do
        expect(subject.password).to be_nil
      end
    end
  end
end
