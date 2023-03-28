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
require "dbus"
require "agama/dbus/interfaces/service_status"
require "agama/dbus/with_service_status"

class DBusObjectWithServiceStatusInterface < ::DBus::Object
  include DInstaller::DBus::WithServiceStatus
  include DInstaller::DBus::Interfaces::ServiceStatus

  def initialize
    super("org.opensuse.DInstaller.UnitTests")
  end
end

describe DBusObjectWithServiceStatusInterface do
  let(:service_status_interface) do
    DInstaller::DBus::Interfaces::ServiceStatus::SERVICE_STATUS_INTERFACE
  end

  it "defines ServiceStatus D-Bus interface" do
    expect(subject.intfs.keys).to include(service_status_interface)
  end

  describe "#service_status_all" do
    it "includes all possible values for the service status" do
      labels = subject.service_status_all.map { |i| i["label"] }
      expect(labels).to contain_exactly("idle", "busy")
    end

    it "associates 'idle' with the id 0" do
      idle = subject.service_status_all.find { |i| i["label"] == "idle" }
      expect(idle["id"]).to eq(0)
    end

    it "associates 'busy' with the id 1" do
      busy = subject.service_status_all.find { |i| i["label"] == "busy" }
      expect(busy["id"]).to eq(1)
    end
  end

  describe "#service_status_current" do
    context "when the current service status is idle" do
      before do
        subject.service_status.idle
      end

      it "returns 0" do
        expect(subject.service_status_current).to eq(0)
      end
    end

    context "when the current service status is busy" do
      before do
        subject.service_status.busy
      end

      it "returns 1" do
        expect(subject.service_status_current).to eq(1)
      end
    end
  end

  describe "#register_service_status_callbacks" do
    it "register callbacks to be called when the service status changes" do
      subject.register_service_status_callbacks

      expect(subject).to receive(:dbus_properties_changed)
        .with(service_status_interface, anything, anything)

      subject.service_status.busy
    end
  end
end
