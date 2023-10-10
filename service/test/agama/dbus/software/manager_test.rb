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
require "agama/config"
require "agama/dbus/clients/locale"
require "agama/dbus/clients/network"
require "agama/dbus/interfaces/issues"
require "agama/dbus/interfaces/progress"
require "agama/dbus/interfaces/service_status"
require "agama/dbus/software/manager"
require "agama/software"

describe Agama::DBus::Software::Manager do
  subject { described_class.new(backend, logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:backend) { Agama::Software::Manager.new(config, logger) }

  let(:config) do
    Agama::Config.new(YAML.safe_load(File.read(config_path)))
  end

  let(:config_path) do
    File.join(FIXTURES_PATH, "root_dir", "etc", "agama.yaml")
  end

  let(:progress_interface) { Agama::DBus::Interfaces::Progress::PROGRESS_INTERFACE }

  let(:service_status_interface) do
    Agama::DBus::Interfaces::ServiceStatus::SERVICE_STATUS_INTERFACE
  end

  let(:issues_interface) { Agama::DBus::Interfaces::Issues::ISSUES_INTERFACE }

  before do
    allow(Agama::DBus::Clients::Locale).to receive(:new).and_return(locale_client)
    allow(Agama::DBus::Clients::Network).to receive(:new).and_return(network_client)
    allow(backend).to receive(:probe)
    allow(backend).to receive(:propose)
    allow(backend).to receive(:install)
    allow(backend).to receive(:finish)
    allow(subject).to receive(:dbus_properties_changed)
  end

  let(:locale_client) do
    instance_double(Agama::DBus::Clients::Locale, on_language_selected: nil)
  end

  let(:network_client) do
    instance_double(Agama::DBus::Clients::Network, on_connection_changed: nil)
  end

  it "defines Issues D-Bus interface" do
    expect(subject.intfs.keys).to include(issues_interface)
  end

  it "defines Progress D-Bus interface" do
    expect(subject.intfs.keys).to include(progress_interface)
  end

  it "defines ServiceStatus D-Bus interface" do
    expect(subject.intfs.keys).to include(service_status_interface)
  end

  it "emits signal when issues changes" do
    expect(subject).to receive(:issues_properties_changed)
    backend.issues = []
  end

  describe "#probe" do
    it "runs the probing, setting the service as busy meanwhile" do
      expect(subject.service_status).to receive(:busy)
      expect(backend).to receive(:probe)
      expect(subject.service_status).to receive(:idle)

      subject.probe
    end
  end

  describe "#propose" do
    it "calculates the proposal, setting the service as busy meanwhile" do
      expect(subject.service_status).to receive(:busy)
      expect(backend).to receive(:propose)
      expect(subject.service_status).to receive(:idle)

      subject.propose
    end
  end

  describe "#install" do
    it "installs the software, setting the service as busy meanwhile" do
      expect(subject.service_status).to receive(:busy)
      expect(backend).to receive(:install)
      expect(subject.service_status).to receive(:idle)

      subject.install
    end
  end

  describe "#finish" do
    it "finishes the software installation, setting the service as busy meanwhile" do
      expect(subject.service_status).to receive(:busy)
      expect(backend).to receive(:finish)
      expect(subject.service_status).to receive(:idle)

      subject.finish
    end
  end

  describe "D-Bus IsPackageInstalled" do
    it "returns whether the package is installed or not" do
      expect(backend).to receive(:package_installed?).with("NetworkManager").and_return(true)
      installed = subject.public_send(
        "org.opensuse.Agama.Software1%%IsPackageInstalled", "NetworkManager"
      )
      expect(installed).to eq(true)
    end
  end

  describe "#reg_code" do
    before do
      allow(backend.registration).to receive(:reg_code).and_return(reg_code)
    end

    context "if there is no registered product yet" do
      let(:reg_code) { nil }

      it "returns an empty string" do
        expect(subject.reg_code).to eq("")
      end
    end

    context "if there is a registered product" do
      let(:reg_code) { "123XX432" }

      it "returns the registration code" do
        expect(subject.reg_code).to eq("123XX432")
      end
    end
  end

  describe "#email" do
    before do
      allow(backend.registration).to receive(:email).and_return(email)
    end

    context "if there is no registered email" do
      let(:email) { nil }

      it "returns an empty string" do
        expect(subject.email).to eq("")
      end
    end

    context "if there is a registered email" do
      let(:email) { "test@suse.com" }

      it "returns the registered email" do
        expect(subject.email).to eq("test@suse.com")
      end
    end
  end

  describe "#requirement" do
    before do
      allow(backend.registration).to receive(:requirement).and_return(requirement)
    end

    context "if the registration is not required" do
      let(:requirement) { Agama::Registration::Requirement::NOT_REQUIRED }

      it "returns 0" do
        expect(subject.requirement).to eq(0)
      end
    end

    context "if the registration is optional" do
      let(:requirement) { Agama::Registration::Requirement::OPTIONAL }

      it "returns 1" do
        expect(subject.requirement).to eq(1)
      end
    end

    context "if the registration is mandatory" do
      let(:requirement) { Agama::Registration::Requirement::MANDATORY }

      it "returns 2" do
        expect(subject.requirement).to eq(2)
      end
    end
  end

  describe "#register" do
    before do
      allow(backend).to receive(:product).and_return("Tumbleweed")
      allow(backend.registration).to receive(:reg_code).and_return(nil)
    end

    context "if there is no product selected yet" do
      before do
        allow(backend).to receive(:product).and_return(nil)
      end

      it "returns result code 1 and description" do
        expect(subject.register("123XX432")).to contain_exactly(1, /product not selected/i)
      end
    end

    context "if the product is already registered" do
      before do
        allow(backend.registration).to receive(:reg_code).and_return("123XX432")
      end

      it "returns result code 2 and description" do
        expect(subject.register("123XX432")).to contain_exactly(2, /product already registered/i)
      end
    end

    context "if the registration is correctly done" do
      before do
        allow(backend.registration).to receive(:register)
      end

      it "returns result code 0 without description" do
        expect(subject.register("123XX432")).to contain_exactly(0, "")
      end
    end

    context "if there is a network error" do
      before do
        allow(backend.registration).to receive(:register).and_raise(SocketError)
      end

      it "returns result code 3 and description" do
        expect(subject.register("123XX432")).to contain_exactly(3, /network error/)
      end
    end

    context "if there is a timeout" do
      before do
        allow(backend.registration).to receive(:register).and_raise(Timeout::Error)
      end

      it "returns result code 4 and description" do
        expect(subject.register("123XX432")).to contain_exactly(4, /timeout/)
      end
    end

    context "if there is an API error" do
      before do
        allow(backend.registration).to receive(:register).and_raise(SUSE::Connect::ApiError, "")
      end

      it "returns result code 5 and description" do
        expect(subject.register("123XX432")).to contain_exactly(5, /registration server failed/)
      end
    end

    context "if there is a missing credials error" do
      before do
        allow(backend.registration)
          .to receive(:register).and_raise(SUSE::Connect::MissingSccCredentialsFile)
      end

      it "returns result code 6 and description" do
        expect(subject.register("123XX432")).to contain_exactly(6, /missing credentials/)
      end
    end

    context "if there is an incorrect credials error" do
      before do
        allow(backend.registration)
          .to receive(:register).and_raise(SUSE::Connect::MalformedSccCredentialsFile)
      end

      it "returns result code 7 and description" do
        expect(subject.register("123XX432")).to contain_exactly(7, /incorrect credentials/)
      end
    end

    context "if there is an invalid certificate error" do
      before do
        allow(backend.registration).to receive(:register).and_raise(OpenSSL::SSL::SSLError)
      end

      it "returns result code 8 and description" do
        expect(subject.register("123XX432")).to contain_exactly(8, /invalid certificate/)
      end
    end

    context "if there is an internal error" do
      before do
        allow(backend.registration).to receive(:register).and_raise(JSON::ParserError)
      end

      it "returns result code 9 and description" do
        expect(subject.register("123XX432")).to contain_exactly(9, /registration server failed/)
      end
    end
  end

  describe "#deregister" do
    before do
      allow(backend).to receive(:product).and_return("Tumbleweed")
      allow(backend.registration).to receive(:reg_code).and_return("123XX432")
    end

    context "if there is no product selected yet" do
      before do
        allow(backend).to receive(:product).and_return(nil)
      end

      it "returns result code 1 and description" do
        expect(subject.deregister).to contain_exactly(1, /product not selected/i)
      end
    end

    context "if the product is not registered yet" do
      before do
        allow(backend.registration).to receive(:reg_code).and_return(nil)
      end

      it "returns result code 2 and description" do
        expect(subject.deregister).to contain_exactly(2, /product not registered/i)
      end
    end

    context "if the deregistration is correctly done" do
      before do
        allow(backend.registration).to receive(:deregister)
      end

      it "returns result code 0 without description" do
        expect(subject.deregister).to contain_exactly(0, "")
      end
    end

    context "if there is a network error" do
      before do
        allow(backend.registration).to receive(:deregister).and_raise(SocketError)
      end

      it "returns result code 3 and description" do
        expect(subject.deregister).to contain_exactly(3, /network error/)
      end
    end

    context "if there is a timeout" do
      before do
        allow(backend.registration).to receive(:deregister).and_raise(Timeout::Error)
      end

      it "returns result code 4 and description" do
        expect(subject.deregister).to contain_exactly(4, /timeout/)
      end
    end

    context "if there is an API error" do
      before do
        allow(backend.registration).to receive(:deregister).and_raise(SUSE::Connect::ApiError, "")
      end

      it "returns result code 5 and description" do
        expect(subject.deregister).to contain_exactly(5, /registration server failed/)
      end
    end

    context "if there is a missing credials error" do
      before do
        allow(backend.registration)
          .to receive(:deregister).and_raise(SUSE::Connect::MissingSccCredentialsFile)
      end

      it "returns result code 6 and description" do
        expect(subject.deregister).to contain_exactly(6, /missing credentials/)
      end
    end

    context "if there is an incorrect credials error" do
      before do
        allow(backend.registration)
          .to receive(:deregister).and_raise(SUSE::Connect::MalformedSccCredentialsFile)
      end

      it "returns result code 7 and description" do
        expect(subject.deregister).to contain_exactly(7, /incorrect credentials/)
      end
    end

    context "if there is an invalid certificate error" do
      before do
        allow(backend.registration).to receive(:deregister).and_raise(OpenSSL::SSL::SSLError)
      end

      it "returns result code 8 and description" do
        expect(subject.deregister).to contain_exactly(8, /invalid certificate/)
      end
    end

    context "if there is an internal error" do
      before do
        allow(backend.registration).to receive(:deregister).and_raise(JSON::ParserError)
      end

      it "returns result code 9 and description" do
        expect(subject.deregister).to contain_exactly(9, /registration server failed/)
      end
    end
  end
end
