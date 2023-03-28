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

require_relative "../test_helper"
require "agama/service_status_recorder"
require "agama/dbus/service_status"

describe DInstaller::ServiceStatusRecorder do
  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:idle) { DInstaller::DBus::ServiceStatus::IDLE }
  let(:busy) { DInstaller::DBus::ServiceStatus::BUSY }

  before do
    subject.on_service_status_change { logger.info("change status") }
  end

  describe "#save" do
    it "stores the status of a service" do
      subject.save("org.opensuse.DInstaller.Test", busy)
      expect(subject.busy_services).to include("org.opensuse.DInstaller.Test")
    end

    context "when the given service status is different to the stored one" do
      before do
        subject.save("org.opensuse.DInstaller.Test", busy)
      end

      it "stores the new status" do
        subject.save("org.opensuse.DInstaller.Test", idle)
        expect(subject.busy_services).to_not include("org.opensuse.DInstaller.Test")
      end

      it "runs the callbacks" do
        expect(logger).to receive(:info).with(/change status/)
        subject.save("org.opensuse.DInstaller.Test", idle)
      end
    end

    context "when the given service status is the same as the stored one" do
      before do
        subject.save("org.opensuse.DInstaller.Test", busy)
      end

      it "does not run the callbacks" do
        expect(logger).to_not receive(:info).with(/change status/)
        subject.save("org.opensuse.DInstaller.Test", busy)
      end
    end
  end

  describe "#busy_services" do
    before do
      subject.save("org.opensuse.DInstaller.Test1", busy)
      subject.save("org.opensuse.DInstaller.Test2", idle)
      subject.save("org.opensuse.DInstaller.Test3", busy)
    end

    it "returns the name of the busy services" do
      expect(subject.busy_services).to contain_exactly(
        "org.opensuse.DInstaller.Test1",
        "org.opensuse.DInstaller.Test3"
      )
    end
  end
end
