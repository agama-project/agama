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
require "agama/dbus/manager"
require "agama/dbus/service_status"
require "agama/installation_phase"
require "agama/service_status_recorder"

describe DInstaller::DBus::Manager do
  subject { described_class.new(backend, logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:backend) do
    instance_double(DInstaller::Manager,
      installation_phase:        installation_phase,
      software:                  software_client,
      on_services_status_change: nil,
      valid?:                    true)
  end

  let(:installation_phase) { DInstaller::InstallationPhase.new }
  let(:software_client) do
    instance_double(DInstaller::DBus::Clients::Software, on_product_selected: nil)
  end
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

  describe ".new" do
    it "configures callbacks for changes in the installation phase" do
      expect(subject).to receive(:dbus_properties_changed) do |iface, properties, _|
        expect(iface).to match(/DInstaller\.Manager1/)
        expect(properties["CurrentInstallationPhase"]).to eq(0)
      end

      installation_phase.startup
    end

    it "configures callbacks for changes in the status of other services" do
      expect(backend).to receive(:on_services_status_change)
      subject
    end

    it "configures callbacks to be called when a product is selected" do
      expect(software_client).to receive(:on_product_selected)
      subject
    end

    it "configures callbacks from Progress interface" do
      expect_any_instance_of(described_class).to receive(:register_progress_callbacks)
      subject
    end

    it "configures callbacks from ServiceStatus interface" do
      expect_any_instance_of(described_class).to receive(:register_service_status_callbacks)
      subject
    end
  end

  describe "#config_phase" do
    context "when the service is idle" do
      before do
        subject.service_status.idle
      end

      it "runs the config phase, setting the service as busy meanwhile" do
        expect(subject.service_status).to receive(:busy)
        expect(backend).to receive(:config_phase)
        expect(subject.service_status).to receive(:idle)

        subject.config_phase
      end
    end

    context "when the service is busy" do
      before do
        subject.service_status.busy
      end

      it "raises a D-Bus error" do
        expect { subject.config_phase }.to raise_error(::DBus::Error)
      end
    end
  end

  describe "#install_phase" do
    context "when the service is idle" do
      before do
        subject.service_status.idle
      end

      it "runs the install phase, setting the service as busy meanwhile" do
        expect(subject.service_status).to receive(:busy)
        expect(backend).to receive(:install_phase)
        expect(subject.service_status).to receive(:idle)

        subject.install_phase
      end
    end

    context "when services configuration is invalid" do
      before do
        allow(backend).to receive(:valid?).and_return(false)
      end

      it "raises a DBus::Error" do
        expect { subject.install_phase }.to raise_error(DBus::Error)
      end
    end

    context "when the service is busy" do
      before do
        subject.service_status.busy
      end

      it "raises a D-Bus error" do
        expect { subject.install_phase }.to raise_error(::DBus::Error)
      end
    end
  end

  describe "#installation_phases" do
    it "includes all possible values for the installation phase" do
      labels = subject.installation_phases.map { |i| i["label"] }
      expect(labels).to contain_exactly("startup", "config", "install")
    end

    it "associates 'startup' with the id 0" do
      startup = subject.installation_phases.find { |i| i["label"] == "startup" }
      expect(startup["id"]).to eq(described_class::STARTUP_PHASE)
    end

    it "associates 'config' with the id 1" do
      config = subject.installation_phases.find { |i| i["label"] == "config" }
      expect(config["id"]).to eq(described_class::CONFIG_PHASE)
    end

    it "associates 'install' with the id 2" do
      install = subject.installation_phases.find { |i| i["label"] == "install" }
      expect(install["id"]).to eq(described_class::INSTALL_PHASE)
    end
  end

  describe "#current_installation_phase" do
    context "when the current installation phase is startup" do
      before do
        installation_phase.startup
      end

      it "returns the startup phase vale" do
        expect(subject.current_installation_phase).to eq(described_class::STARTUP_PHASE)
      end
    end

    context "when the current installation phase is config" do
      before do
        installation_phase.config
      end

      it "returns the config phase value" do
        expect(subject.current_installation_phase).to eq(described_class::CONFIG_PHASE)
      end
    end

    context "when the current installation phase is install" do
      before do
        installation_phase.install
      end

      it "returns the install phase value" do
        expect(subject.current_installation_phase).to eq(described_class::INSTALL_PHASE)
      end
    end
  end

  describe "#busy_services" do
    before do
      allow(backend).to receive(:busy_services).and_return(["org.opensuse.DInstaller.Users"])
    end

    it "returns the names of the busy services" do
      expect(subject.busy_services).to contain_exactly("org.opensuse.DInstaller.Users")
    end
  end

  describe "#can_install?" do
    before do
      allow(backend).to receive(:valid?).and_return(valid?)
    end

    context "when installation settings are valid" do
      let(:valid?) { true }

      it "returns true" do
        expect(subject.can_install?).to eq(true)
      end
    end

    context "when installation settings are valid" do
      let(:valid?) { false }

      it "returns false" do
        expect(subject.can_install?).to eq(false)
      end
    end
  end
end
