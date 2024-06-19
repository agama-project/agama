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
require_relative "with_progress_examples"
require "agama/dbus/clients/storage"
require "dbus"

describe Agama::DBus::Clients::Storage do
  before do
    allow(Agama::DBus::Bus).to receive(:current).and_return(bus)
    allow(bus).to receive(:service).with("org.opensuse.Agama.Storage1").and_return(service)
    allow(service).to receive(:[]).with("/org/opensuse/Agama/Storage1").and_return(dbus_object)
    allow(dbus_object).to receive(:introspect)
    allow(dbus_object).to receive(:[]).with("org.opensuse.Agama.Storage1").and_return(storage_iface)
  end

  let(:bus) { instance_double(Agama::DBus::Bus) }
  let(:service) { instance_double(::DBus::ProxyService) }

  let(:dbus_object) { instance_double(::DBus::ProxyObject) }
  let(:storage_iface) { instance_double(::DBus::ProxyObjectInterface) }

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

  include_examples "issues"
  include_examples "progress"
end
