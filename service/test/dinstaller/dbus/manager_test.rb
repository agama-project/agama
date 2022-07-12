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

require_relative "../../test_helper"
require "dinstaller/dbus/manager"
require "dinstaller/dbus/service_status"
require "dinstaller/installation_phase"
require "dinstaller/service_status_recorder"

describe DInstaller::DBus::Manager do
  subject { described_class.new(backend, logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:backend) do
    instance_double(DInstaller::Manager,
      installation_phase:      installation_phase,
      service_status_recorder: service_status_recorder)
  end

  let(:installation_phase) { DInstaller::InstallationPhase.new }
  let(:service_status_recorder) { DInstaller::ServiceStatusRecorder.new }

  let(:idle) { DInstaller::DBus::ServiceStatus::IDLE }
  let(:busy) { DInstaller::DBus::ServiceStatus::BUSY }
  let(:progress_interface) { DInstaller::DBus::Interfaces::Progress::PROGRESS_INTERFACE }
  let(:service_status_interface) do
    DInstaller::DBus::Interfaces::ServiceStatus::SERVICE_STATUS_INTERFACE
  end

  before do
    allow_any_instance_of(described_class).to receive(:register_progress_callbacks)
    allow_any_instance_of(described_class).to receive(:register_service_status_callbacks)
  end

  it "defines Progress D-Bus interface" do
    expect(subject.intfs.keys).to include(progress_interface)
  end

  it "defines ServiceStatus D-Bus interface" do
    expect(subject.intfs.keys).to include(service_status_interface)
  end

  it "configures callbacks for changes in the installation phase" do
    expect(subject).to receive(:dbus_properties_changed) do |iface, properties, _|
      expect(iface).to match(/DInstaller\.Manager1/)
      expect(properties["CurrentInstallationPhase"]).to eq(0)
    end

    installation_phase.startup
  end

  it "configures callbacks for changes in the status of other services" do
    expect(subject).to receive(:dbus_properties_changed) do |iface, properties, _|
      expect(iface).to match(/DInstaller\.Manager1/)
      expect(properties["BusyServices"]).to contain_exactly("org.opensuse.DInstaller.Users")
    end

    service_status_recorder.save("org.opensuse.DInstaller.Users", busy)
  end

  it "configures callbacks from Progress interface" do
    expect_any_instance_of(described_class).to receive(:register_progress_callbacks)
    subject
  end

  it "configures callbacks from ServiceStatus interface" do
    expect_any_instance_of(described_class).to receive(:register_service_status_callbacks)
    subject
  end

  describe "#config_phase" do
    it "runs the config phase, setting the service as busy meanwhile" do
      expect(subject.service_status).to receive(:busy)
      expect(backend).to receive(:config_phase)
      expect(subject.service_status).to receive(:idle)

      subject.config_phase
    end
  end

  describe "#install_phase" do
    it "runs the install phase, setting the service as busy meanwhile" do
      expect(subject.service_status).to receive(:busy)
      expect(backend).to receive(:install_phase)
      expect(subject.service_status).to receive(:idle)

      subject.install_phase
    end
  end

  describe "#installation_phases" do
    it "includes all possible values for the installation phase" do
      labels = subject.installation_phases.map { |i| i["label"] }
      expect(labels).to contain_exactly("startup", "config", "install")
    end

    it "associates 'startup' with the id 0" do
      startup = subject.installation_phases.find { |i| i["label"] == "startup" }
      expect(startup["id"]).to eq(0)
    end

    it "associates 'config' with the id 1" do
      config = subject.installation_phases.find { |i| i["label"] == "config" }
      expect(config["id"]).to eq(1)
    end

    it "associates 'install' with the id 2" do
      install = subject.installation_phases.find { |i| i["label"] == "install" }
      expect(install["id"]).to eq(2)
    end
  end

  describe "#current_installation_phase" do
    context "when the current installation phase is startup" do
      before do
        installation_phase.startup
      end

      it "returns 0" do
        expect(subject.current_installation_phase).to eq(0)
      end
    end

    context "when the current installation phase is config" do
      before do
        installation_phase.config
      end

      it "returns 1" do
        expect(subject.current_installation_phase).to eq(1)
      end
    end

    context "when the current installation phase is install" do
      before do
        installation_phase.install
      end

      it "returns 2" do
        expect(subject.current_installation_phase).to eq(2)
      end
    end
  end

  describe "#busy_services" do
    before do
      service_status_recorder.save("org.opensuse.DInstaller.Users", busy)
      service_status_recorder.save("org.opensuse.DInstaller.Software", idle)
    end

    it "returns the names of the busy services" do
      expect(subject.busy_services).to contain_exactly("org.opensuse.DInstaller.Users")
    end
  end
end
