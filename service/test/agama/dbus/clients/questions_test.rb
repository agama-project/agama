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
require "agama/dbus/clients/questions"
require "agama/question"
require "dbus"

describe Agama::DBus::Clients::Questions do
  before do
    allow(Agama::DBus::Bus).to receive(:current).and_return(bus)
    allow(bus).to receive(:service).with("org.opensuse.DInstaller.Questions").and_return(service)
    allow(service).to receive(:[]).with("/org/opensuse/DInstaller/Questions1")
      .and_return(dbus_object)
    allow(dbus_object).to receive(:default_iface=)
  end

  subject { described_class.new(logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:bus) { instance_double(Agama::DBus::Bus) }
  let(:service) { instance_double(::DBus::Service) }
  let(:dbus_object) { instance_double(::DBus::ProxyObject) }
  let(:properties_iface) { instance_double(::DBus::ProxyObjectInterface) }

  let(:question1) { Agama::Question.new("What?", options: [:this, :that]) }
  let(:question2) do
    Agama::Question.new("When?", options: [:now, :later], default_option: :now)
  end
  let(:question1_proxy) do
    instance_double(::DBus::ProxyObject, path: "/org/opensuse/DInstaller/Questions1/33")
  end
  let(:question1_stub) do
    instance_double(Agama::DBus::Clients::Question, dbus_object: question1_proxy)
  end

  describe "#add" do
    # Using partial double because methods are dynamically added to the proxy object
    let(:dbus_object) { double(::DBus::ProxyObject) }

    it "asks the service to add a question and returns a stub object for it" do
      expect(dbus_object).to receive(:New).with("What?", ["this", "that"], [])
      expect(Agama::DBus::Clients::Question).to receive(:new).and_return(question1_stub)
      expect(subject.add(question1)).to eq question1_stub
    end
  end

  describe "#delete" do
    # Using partial double because methods are dynamically added to the proxy object
    let(:dbus_object) { double(::DBus::ProxyObject) }

    it "asks the service to delete the question" do
      expect(dbus_object).to receive(:Delete).with(question1_proxy.path)
      expect { subject.delete(question1_stub) }.to_not raise_error
    end

    it "propagates errors" do
      # let's say we mistakenly try to delete the same Q twice
      error = DBus::Error.new("Oopsie")
      allow(dbus_object).to receive(:Delete).and_raise(error)
      expect { subject.delete(question1_stub) }.to raise_error(DBus::Error)
    end
  end

  describe "#wait" do
    it "loops and sleeps until all specified questions are answered" do
      expect(question1).to receive(:answered?).and_return(true)
      expect(question2).to receive(:answered?).and_return(false, true)

      expect(subject).to receive(:sleep).exactly(1).times
      subject.wait([question1, question2])
    end
  end
end
