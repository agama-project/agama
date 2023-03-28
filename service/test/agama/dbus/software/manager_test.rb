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
require "agama/dbus/software/manager"
require "agama/dbus/interfaces/progress"
require "agama/dbus/interfaces/service_status"
require "agama/dbus/interfaces/validation"
require "agama/software"

describe Agama::DBus::Software::Manager do
  subject { described_class.new(backend, logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:backend) { instance_double(Agama::Software::Manager) }

  let(:progress_interface) { Agama::DBus::Interfaces::Progress::PROGRESS_INTERFACE }

  let(:service_status_interface) do
    Agama::DBus::Interfaces::ServiceStatus::SERVICE_STATUS_INTERFACE
  end

  let(:validation_interface) { Agama::DBus::Interfaces::Validation::VALIDATION_INTERFACE }

  before do
    allow_any_instance_of(described_class).to receive(:register_callbacks)
    allow_any_instance_of(described_class).to receive(:register_progress_callbacks)
    allow_any_instance_of(described_class).to receive(:register_service_status_callbacks)
  end

  it "defines Progress D-Bus interface" do
    expect(subject.intfs.keys).to include(progress_interface)
  end

  it "defines ServiceStatus D-Bus interface" do
    expect(subject.intfs.keys).to include(service_status_interface)
  end

  it "defines Validation D-Bus interface" do
    expect(subject.intfs.keys).to include(validation_interface)
  end

  it "configures callbacks from Progress interface" do
    expect_any_instance_of(described_class).to receive(:register_progress_callbacks)
    subject
  end

  it "configures callbacks from ServiceStatus interface" do
    expect_any_instance_of(described_class).to receive(:register_service_status_callbacks)
    subject
  end

  describe "#probe" do
    before do
      allow(subject).to receive(:update_validation)
      allow(backend).to receive(:probe)
    end

    it "runs the probing, setting the service as busy meanwhile" do
      expect(subject.service_status).to receive(:busy)
      expect(backend).to receive(:probe)
      expect(subject.service_status).to receive(:idle)

      subject.probe
    end

    it "updates validation" do
      expect(subject).to receive(:update_validation)

      subject.probe
    end
  end

  describe "#propose" do
    before do
      allow(subject).to receive(:update_validation)
      allow(backend).to receive(:propose)
    end

    it "calculates the proposal, setting the service as busy meanwhile" do
      expect(subject.service_status).to receive(:busy)
      expect(backend).to receive(:propose)
      expect(subject.service_status).to receive(:idle)

      subject.propose
    end

    it "updates validation" do
      expect(subject).to receive(:update_validation)

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
end
