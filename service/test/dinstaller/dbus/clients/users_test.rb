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
require "dinstaller/dbus/clients/users"
require "dinstaller/dbus/service_status"
require "dinstaller/dbus/interfaces/service_status"
require "dbus"

describe DInstaller::DBus::Clients::Users do
  before do
    allow(::DBus::SystemBus).to receive(:instance).and_return(bus)
    allow(bus).to receive(:service).with("org.opensuse.DInstaller.Users").and_return(service)
    allow(service).to receive(:object).with("/org/opensuse/DInstaller/Users1")
      .and_return(dbus_object)
    allow(dbus_object).to receive(:introspect)
    allow(dbus_object).to receive(:[]).with("org.opensuse.DInstaller.Users1")
      .and_return(users_iface)
    allow(dbus_object).to receive(:[]).with("org.opensuse.DInstaller.ServiceStatus1")
      .and_return(service_status_iface)
  end

  let(:bus) { instance_double(::DBus::SystemBus) }
  let(:service) { instance_double(::DBus::Service) }
  let(:dbus_object) { instance_double(::DBus::ProxyObject) }
  let(:users_iface) { instance_double(::DBus::ProxyObjectInterface) }
  let(:service_status_iface) { instance_double(::DBus::ProxyObjectInterface) }

  subject { described_class.new }

  describe "#service_status" do
    before do
      allow(service_status_iface).to receive(:[]).with("Current")
        .and_return(DInstaller::DBus::Interfaces::ServiceStatus::SERVICE_STATUS_BUSY)
    end

    it "returns the value of the service status" do
      expect(subject.service_status).to eq(DInstaller::DBus::ServiceStatus::BUSY)
    end
  end

  describe "#first_user" do
    before do
      allow(users_iface).to receive(:[]).with("FirstUser").and_return(
        ["Test user", "user", true, {}]
      )
    end

    it "returns the configuration of the first user" do
      expect(subject.first_user).to contain_exactly("Test user", "user", true)
    end
  end

  describe "#create_first_user" do
    # Using partial double because methods are dynamically added to the proxy object
    let(:dbus_object) { double(::DBus::ProxyObject) }

    it "configures the first user" do
      expect(dbus_object).to receive(:SetFirstUser).with("Test user", "user", "n0ts3cr3t", true, {})

      subject.create_first_user("user",
        fullname: "Test user", password: "n0ts3cr3t", autologin: true)
    end
  end

  describe "#remove_first_user" do
    # Using partial double because methods are dynamically added to the proxy object
    let(:dbus_object) { double(::DBus::ProxyObject) }

    it "removes the configuration of the first user" do
      expect(dbus_object).to receive(:RemoveFirstUser)

      subject.remove_first_user
    end
  end

  describe "#root_ssh_key" do
    before do
      allow(users_iface).to receive(:[]).with("RootSSHKey").and_return("1234-abcd")
    end

    it "returns SSH key for root" do
      expect(subject.root_ssh_key).to eq("1234-abcd")
    end
  end

  describe "#root_ssh_key=" do
    # Using partial double because methods are dynamically added to the proxy object
    let(:dbus_object) { double(::DBus::ProxyObject) }

    it "sets the SSH key for root" do
      expect(dbus_object).to receive(:SetRootSSHKey).with("1234-abcd")

      subject.root_ssh_key = "1234-abcd"
    end
  end

  describe "#root_password?" do
    before do
      allow(users_iface).to receive(:[]).with("RootPasswordSet").and_return(true)
    end

    it "returns whether the root password is set" do
      expect(subject.root_password?).to eq(true)
    end
  end

  describe "#root_password=" do
    # Using partial double because methods are dynamically added to the proxy object
    let(:dbus_object) { double(::DBus::ProxyObject) }

    it "sets the password for root" do
      expect(dbus_object).to receive(:SetRootPassword).with("n0ts3cr3t", false)

      subject.root_password = "n0ts3cr3t"
    end
  end

  describe "#remove_root_info" do
    # Using partial double because methods are dynamically added to the proxy object
    let(:dbus_object) { double(::DBus::ProxyObject) }

    it "removes the SSH key and password for root" do
      expect(dbus_object).to receive(:RemoveRootPassword)
      expect(dbus_object).to receive(:SetRootSSHKey).with("")

      subject.remove_root_info
    end
  end

  describe "#write" do
    # Using partial double because methods are dynamically added to the proxy object
    let(:dbus_object) { double(::DBus::ProxyObject) }

    it "applies changes into the system" do
      expect(dbus_object).to receive(:Write)

      subject.write
    end
  end
end
