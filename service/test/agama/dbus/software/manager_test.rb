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

  let(:config) { Agama::Config.new(config_data) }

  let(:config_data) do
    path = File.join(FIXTURES_PATH, "root_dir/etc/agama.yaml")
    YAML.safe_load(File.read(path))
  end

  let(:progress_interface) { Agama::DBus::Interfaces::Progress::PROGRESS_INTERFACE }

  let(:service_status_interface) do
    Agama::DBus::Interfaces::ServiceStatus::SERVICE_STATUS_INTERFACE
  end

  let(:issues_interface) { Agama::DBus::Interfaces::Issues::ISSUES_INTERFACE }

  before do
    allow(Agama::DBus::Clients::Locale).to receive(:instance).and_return(locale_client)
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
    it "runs the probing, setting the service as busy meanwhile, and emits a signal" do
      expect(subject.service_status).to receive(:busy)
      expect(backend).to receive(:probe)
      expect(subject.service_status).to receive(:idle)
      expect(subject).to receive(:ProbeFinished)

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

  describe "D-Bus IsPackageAvailable" do
    it "returns whether the package is available or not" do
      expect(backend).to receive(:package_available?).with("NetworkManager").and_return(true)
      available = subject.public_send(
        "org.opensuse.Agama.Software1%%IsPackageAvailable", "NetworkManager"
      )
      expect(available).to eq(true)
    end
  end
end
