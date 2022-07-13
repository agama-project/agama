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
require "dinstaller/dbus/software/manager"
require "dinstaller/dbus/interfaces/progress"
require "dinstaller/dbus/interfaces/service_status"
require "dinstaller/software"

describe DInstaller::DBus::Software::Manager do
  subject { described_class.new(backend, logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:backend) { instance_double(DInstaller::Software) }

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

  it "configures callbacks from Progress interface" do
    expect_any_instance_of(described_class).to receive(:register_progress_callbacks)
    subject
  end

  it "configures callbacks from ServiceStatus interface" do
    expect_any_instance_of(described_class).to receive(:register_service_status_callbacks)
    subject
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
end
